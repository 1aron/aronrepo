import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getIDToken } from '@actions/core'
import SemanticReleaseError from '@semantic-release/error'
import { execa } from 'execa'
import fse from 'fs-extra'
import normalizeUrl from 'normalize-url'
import { validRange } from 'semver'
import type {
    AddChannelContext,
    PrepareContext,
    PublishContext,
    VerifyConditionsContext
} from 'semantic-release'

export interface SemanticReleasePnpmConfig {
    npmPublish?: boolean
    pkgRoot?: string
    tarballDir?: string | false
    publishBranch?: string
    disableScripts?: boolean
}

export interface PackageJson {
    name?: string
    version?: string
    private?: boolean
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
    publishConfig?: {
        access?: string
        provenance?: boolean
        registry?: string
        tag?: string
        [key: string]: unknown
    }
    [key: string]: unknown
}

interface RegistryContext {
    cwd: string
    env: Record<string, string | undefined>
}

interface ResolvedAuth {
    npmrc: string
    verifyWithWhoami: boolean
}

interface PublishArgsOptions {
    basePath: string
    distTag: string
    registry: string
    publishBranch?: string
    disableScripts?: boolean
    provenance?: boolean
}

type ReleaseContext = VerifyConditionsContext | PrepareContext | PublishContext | AddChannelContext

export const OFFICIAL_NPM_REGISTRY = 'https://registry.npmjs.org/'

const verifiedAuth = new Map<string, string>()
const preparedPackages = new Set<string>()

function createError(code: string, message: string, details: string) {
    return new SemanticReleaseError(message, code, details)
}

function getContextCwd(context: ReleaseContext) {
    return context.cwd ?? process.cwd()
}

function resolvePkgRoot(cwd: string, pkgRoot?: string) {
    return pkgRoot ? path.resolve(cwd, pkgRoot) : cwd
}

function getPackagePath(cwd: string, pkgRoot?: string) {
    return path.join(resolvePkgRoot(cwd, pkgRoot), 'package.json')
}

export async function readPackage(cwd: string, pkgRoot?: string) {
    const packagePath = getPackagePath(cwd, pkgRoot)
    if (!await fse.pathExists(packagePath)) {
        throw createError(
            'ENOPKG',
            'Missing package.json file.',
            `A package.json file is required at ${packagePath}.`
        )
    }

    const pkg = await fse.readJson(packagePath) as PackageJson
    if (!pkg.name) {
        throw createError(
            'ENOPKGNAME',
            'Missing name property in package.json.',
            `The package.json file at ${packagePath} must define a package name.`
        )
    }
    return pkg
}

export function getChannel(channel?: string | false | null) {
    if (!channel) return 'latest'
    return validRange(channel) ? `release-${channel}` : channel
}

function normalizeRegistry(registry: string) {
    return registry.endsWith('/') ? registry : `${registry}/`
}

function readNpmrc(pathname?: string) {
    if (!pathname || !fs.existsSync(pathname)) return {}

    const config: Record<string, string> = {}
    for (const line of fs.readFileSync(pathname, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue

        const separator = trimmed.indexOf('=')
        if (separator === -1) continue

        const key = trimmed.slice(0, separator).trim()
        const value = trimmed.slice(separator + 1).trim()
        config[key] = value
    }
    return config
}

function findNpmrc(cwd: string, env: RegistryContext['env']) {
    if (env.NPM_CONFIG_USERCONFIG && fs.existsSync(env.NPM_CONFIG_USERCONFIG)) {
        return env.NPM_CONFIG_USERCONFIG
    }

    const projectNpmrc = path.join(cwd, '.npmrc')
    return fs.existsSync(projectNpmrc) ? projectNpmrc : undefined
}

function readNpmrcContent(pathname?: string) {
    return pathname && fs.existsSync(pathname) ? fs.readFileSync(pathname, 'utf8').trim() : ''
}

export function resolveRegistry(pkg: PackageJson, context: RegistryContext) {
    const scope = pkg.name?.startsWith('@') ? pkg.name.split('/')[0] : undefined
    const publishConfig = pkg.publishConfig ?? {}
    const scopedPublishRegistry = scope ? publishConfig[`${scope}:registry`] : undefined

    if (typeof scopedPublishRegistry === 'string') return normalizeRegistry(scopedPublishRegistry)
    if (typeof publishConfig.registry === 'string') return normalizeRegistry(publishConfig.registry)
    if (context.env.NPM_CONFIG_REGISTRY) return normalizeRegistry(context.env.NPM_CONFIG_REGISTRY)

    const npmrc = readNpmrc(findNpmrc(context.cwd, context.env))
    const scopedNpmrcRegistry = scope ? npmrc[`${scope}:registry`] : undefined
    if (scopedNpmrcRegistry) return normalizeRegistry(scopedNpmrcRegistry)
    if (npmrc.registry) return normalizeRegistry(npmrc.registry)

    return OFFICIAL_NPM_REGISTRY
}

function nerfDart(registry: string) {
    const parsed = new URL(registry)
    const pathname = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`
    return `//${parsed.host}${pathname}`
}

function hasAuth(npmrc: Record<string, string>, registry: string) {
    const nerfed = nerfDart(registry)
    return Object.keys(npmrc).some((key) => (
        key === '_authToken'
        || key === '_auth'
        || key.startsWith(`${nerfed}:_auth`)
    ))
}

function writeNpmrc(content: string) {
    const npmrcPath = path.join(os.tmpdir(), `aronrepo-semantic-release-pnpm-${process.pid}-${Date.now()}.npmrc`)
    fs.writeFileSync(npmrcPath, `${content.trim()}\n`)
    return npmrcPath
}

async function getOidcIdentityToken(pkg: PackageJson, context: ReleaseContext) {
    if (!pkg.name) return undefined
    if (context.env.NPM_ID_TOKEN) return context.env.NPM_ID_TOKEN
    if (context.env.GITHUB_ACTIONS !== 'true') return undefined

    try {
        return await getIDToken('npm:registry.npmjs.org')
    } catch (error) {
        context.logger.warn(`Could not get GitHub Actions OIDC token: ${error instanceof Error ? error.message : String(error)}`)
        return undefined
    }
}

export async function exchangeOidcToken(pkg: PackageJson, context: ReleaseContext, registry: string) {
    if (!pkg.name) return undefined
    if (normalizeUrl(registry) !== normalizeUrl(OFFICIAL_NPM_REGISTRY)) return undefined

    const identityToken = await getOidcIdentityToken(pkg, context)
    if (!identityToken) return undefined

    const response = await fetch(
        `${OFFICIAL_NPM_REGISTRY}-/npm/v1/oidc/token/exchange/package/${encodeURIComponent(pkg.name)}`,
        {
            method: 'POST',
            headers: {
                authorization: `Bearer ${identityToken}`
            }
        }
    )

    if (!response.ok) {
        context.logger.warn(`Could not exchange OIDC token for ${pkg.name}: ${response.status} ${response.statusText}`)
        return undefined
    }

    const body = await response.json() as { token?: string }
    return body.token
}

async function resolveAuth(pkg: PackageJson, context: ReleaseContext, registry: string): Promise<ResolvedAuth> {
    const cwd = getContextCwd(context)
    const sourceNpmrc = findNpmrc(cwd, context.env)
    const sourceConfig = readNpmrc(sourceNpmrc)
    const sourceContent = readNpmrcContent(sourceNpmrc)

    if (hasAuth(sourceConfig, registry)) {
        return {
            npmrc: writeNpmrc(sourceContent),
            verifyWithWhoami: true
        }
    }

    const oidcToken = await exchangeOidcToken(pkg, context, registry)
    if (oidcToken) {
        return {
            npmrc: writeNpmrc(`${sourceContent}\n${nerfDart(registry)}:_authToken=${oidcToken}`),
            verifyWithWhoami: false
        }
    }

    if (context.env.NPM_TOKEN) {
        return {
            npmrc: writeNpmrc(`${sourceContent}\n${nerfDart(registry)}:_authToken=\${NPM_TOKEN}`),
            verifyWithWhoami: true
        }
    }

    throw createError(
        'ENONPMTOKEN',
        'No npm token specified.',
        `Set NPM_TOKEN, NPM_ID_TOKEN, or npm auth in .npmrc to publish to ${registry}.`
    )
}

export async function createAuthNpmrc(pkg: PackageJson, context: ReleaseContext, registry: string) {
    return (await resolveAuth(pkg, context, registry)).npmrc
}

function shouldPublish(pluginConfig: SemanticReleasePnpmConfig, pkg: PackageJson) {
    return pluginConfig.npmPublish !== false && pkg.private !== true
}

function getAuthKey(pkg: PackageJson, registry: string) {
    return `${pkg.name ?? ''}:${registry}`
}

function verifyNpmAuthWithWhoami(npmrc: string, registry: string, context: ReleaseContext) {
    const cwd = getContextCwd(context)
    const result = execa('pnpm', ['whoami', '--registry', registry], {
        cwd,
        env: {
            ...context.env,
            NPM_CONFIG_USERCONFIG: npmrc
        },
        preferLocal: true
    })

    result.stdout?.pipe(context.stdout, { end: false })
    result.stderr?.pipe(context.stderr, { end: false })

    return result
}

async function ensureAuth(pluginConfig: SemanticReleasePnpmConfig, pkg: PackageJson, context: ReleaseContext) {
    if (!shouldPublish(pluginConfig, pkg)) return undefined

    const cwd = getContextCwd(context)
    const registry = resolveRegistry(pkg, { cwd, env: context.env })
    const authKey = getAuthKey(pkg, registry)
    const cached = verifiedAuth.get(authKey)
    if (cached) return cached

    const auth = await resolveAuth(pkg, context, registry)

    try {
        if (auth.verifyWithWhoami) {
            await verifyNpmAuthWithWhoami(auth.npmrc, registry, context)
        } else {
            context.logger.log(`Skip pnpm whoami verification for ${pkg.name ?? registry} because npm Trusted Publishing exchanged a publish token.`)
        }
    } catch (error) {
        throw createError(
            'EINVALIDNPMAUTH',
            'Invalid npm authentication.',
            `The configured npm authentication cannot publish to ${registry}. ${error instanceof Error ? error.message : String(error)}`
        )
    }

    verifiedAuth.set(authKey, auth.npmrc)
    return auth.npmrc
}

export async function writeReleaseVersion(cwd: string, pkgRoot: string | undefined, version: string) {
    const packagePath = getPackagePath(cwd, pkgRoot)
    const pkg = await fse.readJson(packagePath) as PackageJson
    pkg.version = version
    await fse.writeJson(packagePath, pkg, { spaces: 4 })

    const shrinkwrapPath = path.join(resolvePkgRoot(cwd, pkgRoot), 'npm-shrinkwrap.json')
    if (await fse.pathExists(shrinkwrapPath)) {
        const shrinkwrap = await fse.readJson(shrinkwrapPath) as { version?: string }
        shrinkwrap.version = version
        await fse.writeJson(shrinkwrapPath, shrinkwrap, { spaces: 4 })
    }
}

export function buildPublishArgs(options: PublishArgsOptions) {
    const args = [
        'publish',
        options.basePath,
        '--tag',
        options.distTag,
        '--registry',
        options.registry,
        '--no-git-checks'
    ]

    if (options.publishBranch) {
        args.push('--publish-branch', options.publishBranch)
    }

    if (options.disableScripts) {
        args.push('--ignore-scripts')
    }

    if (options.provenance) {
        args.push('--provenance')
    }

    return args
}

function pipeSubprocess(result: ReturnType<typeof execa>, context: ReleaseContext) {
    result.stdout?.pipe(context.stdout, { end: false })
    result.stderr?.pipe(context.stderr, { end: false })
    return result
}

async function preparePackage(pluginConfig: SemanticReleasePnpmConfig, context: PrepareContext | PublishContext) {
    const cwd = getContextCwd(context)
    const basePath = resolvePkgRoot(cwd, pluginConfig.pkgRoot)

    context.logger.log(`Write version ${context.nextRelease.version} to package.json in ${basePath}`)
    await writeReleaseVersion(cwd, pluginConfig.pkgRoot, context.nextRelease.version)
    preparedPackages.add(basePath)

    if (pluginConfig.tarballDir) {
        const tarballDir = path.resolve(cwd, pluginConfig.tarballDir)
        await fse.ensureDir(tarballDir)
        context.logger.log(`Create pnpm package tarball in ${tarballDir}`)
        await pipeSubprocess(
            execa('pnpm', ['pack', '--pack-destination', tarballDir], {
                cwd: basePath,
                env: context.env,
                preferLocal: true
            }),
            context
        )
    }
}

export async function verifyConditions(pluginConfig: SemanticReleasePnpmConfig, context: VerifyConditionsContext) {
    const pkg = await readPackage(getContextCwd(context), pluginConfig.pkgRoot)
    await ensureAuth(pluginConfig, pkg, context)
}

export async function prepare(pluginConfig: SemanticReleasePnpmConfig, context: PrepareContext) {
    await preparePackage(pluginConfig, context)
}

export async function publish(pluginConfig: SemanticReleasePnpmConfig, context: PublishContext) {
    const cwd = getContextCwd(context)
    const basePath = resolvePkgRoot(cwd, pluginConfig.pkgRoot)
    const pkg = await readPackage(cwd, pluginConfig.pkgRoot)

    if (!preparedPackages.has(basePath)) {
        await preparePackage(pluginConfig, context)
    }

    if (!shouldPublish(pluginConfig, pkg)) {
        context.logger.log(`Skip publishing ${pkg.name ?? basePath}`)
        return false
    }

    const npmrc = await ensureAuth(pluginConfig, pkg, context)
    const registry = resolveRegistry(pkg, { cwd, env: context.env })
    const distTag = getChannel(context.nextRelease.channel)
    const args = buildPublishArgs({
        basePath,
        distTag,
        registry,
        publishBranch: pluginConfig.publishBranch,
        disableScripts: pluginConfig.disableScripts,
        provenance: pkg.publishConfig?.provenance
    })

    context.logger.log(`Publish ${pkg.name}@${context.nextRelease.version} to ${registry} on dist-tag ${distTag}`)
    await pipeSubprocess(
        execa('pnpm', args, {
            cwd,
            env: {
                ...context.env,
                ...(npmrc ? { NPM_CONFIG_USERCONFIG: npmrc } : {})
            },
            preferLocal: true
        }),
        context
    )

    return {
        channel: distTag,
        name: `pnpm package (@${distTag} dist-tag)`,
        url: normalizeUrl(registry) === normalizeUrl(OFFICIAL_NPM_REGISTRY)
            ? `https://www.npmjs.com/package/${pkg.name}/v/${context.nextRelease.version}`
            : undefined
    }
}

export async function addChannel(pluginConfig: SemanticReleasePnpmConfig, context: AddChannelContext) {
    const cwd = getContextCwd(context)
    const pkg = await readPackage(cwd, pluginConfig.pkgRoot)

    if (!shouldPublish(pluginConfig, pkg)) {
        context.logger.log(`Skip adding dist-tag for ${pkg.name ?? pluginConfig.pkgRoot ?? cwd}`)
        return false
    }

    const npmrc = await ensureAuth(pluginConfig, pkg, context)
    const registry = resolveRegistry(pkg, { cwd, env: context.env })
    const distTag = getChannel(context.nextRelease.channel)
    const spec = `${pkg.name}@${context.nextRelease.version}`

    context.logger.log(`Add ${spec} to npm dist-tag ${distTag}`)
    await pipeSubprocess(
        execa('pnpm', ['dist-tag', 'add', spec, distTag, '--registry', registry], {
            cwd,
            env: {
                ...context.env,
                ...(npmrc ? { NPM_CONFIG_USERCONFIG: npmrc } : {})
            },
            preferLocal: true
        }),
        context
    )

    return {
        channel: distTag,
        name: `pnpm package (@${distTag} dist-tag)`,
        url: normalizeUrl(registry) === normalizeUrl(OFFICIAL_NPM_REGISTRY)
            ? `https://www.npmjs.com/package/${pkg.name}/v/${context.nextRelease.version}`
            : undefined
    }
}
