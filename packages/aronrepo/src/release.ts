import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import semver from 'semver'
import type { ReleaseType } from './commits'
import { renderReleaseNotes } from './notes'
import { resolveRelease, type CommitDecision, type ReleaseAsset, type ReleasePolicy } from './policy'
import {
    detectPackageManager,
    getRangeCommits,
    loadProjectPolicy,
    queryReleaseDirs,
    readJsonFile,
    type PackageJson,
    type PackageManager
} from './project'
import {
    getBaseTag,
    getNextVersion,
    getReleaseChannel,
    parseVersionTag,
    toVersionTag,
    type ReleaseChannel
} from './version'

export const officialRegistry = 'https://registry.npmjs.org/'

/** npm dist-tag that holds a release until every package of it is published. */
export const stagingDistTag = 'aronrepo-staging'

/** GitHub rejects release bodies over 125,000 characters. */
export const releaseBodyLimit = 120_000

export interface RunResult {
    stdout: string
    stderr: string
}

export type Runner = (command: string, args: string[], options: { cwd: string, env: NodeJS.ProcessEnv }) => Promise<RunResult>

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>

export interface ReleaseEnvironment {
    cwd: string
    env: NodeJS.ProcessEnv
    run: Runner
    fetch: Fetch
    log: (message: string) => void
    /** Waits between registry checks. */
    wait: (ms: number) => Promise<void>
}

/** Quotes an argument for `cmd.exe`, which runs `.cmd` shims such as `npm.cmd` on Windows. */
export function quoteWindowsArg(arg: string) {
    if (/^[\w@+=:,./\\-]+$/.test(arg)) return arg
    return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1')}"`
}

export const runCommand: Runner = (command, args, { cwd, env }) => new Promise((resolve, reject) => {
    // Windows needs a shell for `.cmd` shims, and a shell joins arguments without quoting them.
    const child = process.platform === 'win32'
        ? spawn([command, ...args].map(quoteWindowsArg).join(' '), { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], shell: true })
        : spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code, signal) => {
        if (code === 0) resolve({ stdout, stderr })
        else reject(new Error(`\`${command} ${args.join(' ')}\` ${signal ? `was stopped by ${signal}` : `exited with ${code}`}.\n${stderr.trim() || stdout.trim()}`))
    })
})

function createEnvironment(options: Partial<ReleaseEnvironment> = {}): ReleaseEnvironment {
    return {
        cwd: options.cwd ?? process.cwd(),
        env: options.env ?? process.env,
        run: options.run ?? runCommand,
        fetch: options.fetch ?? ((input, init) => fetch(input, init)),
        log: options.log ?? ((message) => console.log(message)),
        wait: options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
    }
}

/** Variables that hold credentials. Package scripts that run while packing never see them. */
const secretVariables = [
    'NPM_TOKEN', 'NODE_AUTH_TOKEN', 'NPM_ID_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN',
    'ACTIONS_ID_TOKEN_REQUEST_TOKEN', 'ACTIONS_ID_TOKEN_REQUEST_URL', 'ACTIONS_RUNTIME_TOKEN'
]

function withoutSecrets(env: NodeJS.ProcessEnv) {
    return Object.fromEntries(Object.entries(env).filter(([key]) => !secretVariables.includes(key.toUpperCase())))
}

async function git(environment: ReleaseEnvironment, args: string[]) {
    return (await environment.run('git', args, { cwd: environment.cwd, env: environment.env })).stdout.trim()
}

async function gitSucceeds(environment: ReleaseEnvironment, args: string[]) {
    try {
        await git(environment, args)
        return true
    } catch {
        return false
    }
}

function lines(output: string) {
    return output.split('\n').map((line) => line.trim()).filter(Boolean)
}

export interface ReleasePackage {
    /** Directory relative to the repository root, `.` for the root package. */
    dir: string
    name: string
    manifest: PackageJson
}

const readJson = readJsonFile

const dependencyFields = ['dependencies', 'optionalDependencies', 'peerDependencies'] as const

/** Fields whose packages must be published first; peers only need to exist when installed. */
const orderFields = ['dependencies', 'optionalDependencies'] as const

/** Published packages of the repository in dependency order. */
export function getReleasePackages(cwd: string): ReleasePackage[] {
    const packages = queryReleaseDirs(cwd).map((dir) => {
        const manifest = readJson<PackageJson>(path.join(cwd, dir, 'package.json'))
        if (!manifest.name) throw new Error(`${dir}/package.json has no name.`)
        return { dir, name: manifest.name, manifest }
    })
    const names = new Map<string, string>()
    for (const { dir, name } of packages) {
        if (names.has(name)) throw new Error(`${names.get(name)}/package.json and ${dir}/package.json are both named ${name}.`)
        names.set(name, dir)
    }
    const dependenciesOf = (pkg: ReleasePackage) => orderFields
        .flatMap((field) => Object.keys((pkg.manifest[field] ?? {}) as Record<string, string>))
        .filter((name) => names.has(name) && name !== pkg.name)

    const ordered: ReleasePackage[] = []
    const visiting = new Set<string>()
    const visit = (pkg: ReleasePackage) => {
        if (ordered.includes(pkg)) return
        if (visiting.has(pkg.name)) throw new Error(`Published packages depend on each other in a cycle through ${pkg.name}.`)
        visiting.add(pkg.name)
        for (const name of dependenciesOf(pkg)) visit(packages.find((candidate) => candidate.name === name)!)
        visiting.delete(pkg.name)
        ordered.push(pkg)
    }
    for (const pkg of [...packages].sort((a, b) => a.dir.localeCompare(b.dir))) visit(pkg)
    return ordered
}

export interface ReleasePlan {
    branch: string
    channel?: ReleaseChannel
    /** Full hash of the commit that releases. */
    head: string
    mode: ReleasePolicy['mode']
    /** The tag the range starts from; `undefined` for the first release. */
    from?: string
    release: ReleaseType
    version?: string
    tag?: string
    commits: CommitDecision[]
    notes?: string
    packages: ReleasePackage[]
    /** Files attached to the GitHub release, from `release.assets`. */
    assets?: ReleaseAsset[]
}

export interface PlanReleaseOptions {
    /** Defaults to `GITHUB_REF_NAME`, then the checked-out branch. */
    branch?: string
    mode?: ReleasePolicy['mode']
    /** Plan as if the branch were `main` when it does not release, for `aronrepo explain` on feature branches. */
    fallbackToMain?: boolean
    /** Tags to ignore, to rebuild the plan of a release that is already tagged. */
    ignoreTags?: string[]
    /** Use this version instead of numbering one, to rebuild the plan of a tagged release. */
    version?: string
    date?: string
}

/**
 * The repository URL on GitHub, from `GITHUB_REPOSITORY` or the root package.json.
 * `owner/repo` and `github:owner/repo` are npm shorthands for GitHub.
 */
export function getRepositoryUrl(cwd: string, env: NodeJS.ProcessEnv = process.env) {
    if (env.GITHUB_REPOSITORY) return `${(env.GITHUB_SERVER_URL ?? 'https://github.com').replace(/\/+$/, '')}/${env.GITHUB_REPOSITORY}`
    const root = path.join(cwd, 'package.json')
    if (!fs.existsSync(root)) return undefined
    const repository = readJson<PackageJson>(root).repository as string | { url?: string } | undefined
    const url = (typeof repository === 'string' ? repository : repository?.url)?.replace(/#.*$/, '')
    if (!url) return undefined
    const shorthand = /^(?:github:)?([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(url)
    const match = shorthand ?? /(?:^|[/@])github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(url)
    return match ? `https://github.com/${match[1]}` : undefined
}

async function getBranch(environment: ReleaseEnvironment, branch?: string) {
    if (branch) return branch
    const checkedOut = await git(environment, ['rev-parse', '--abbrev-ref', 'HEAD'])
    const ref = environment.env.GITHUB_REF_NAME
    if (!ref) return checkedOut
    // A workflow can run on `main` and check out another branch; release the branch that is checked out, not the event's.
    if (checkedOut !== 'HEAD' && checkedOut !== ref) {
        throw new Error(`GITHUB_REF_NAME is ${ref}, but ${checkedOut} is checked out. Pass --branch to choose the release branch.`)
    }
    return ref
}

function renderPlanNotes(environment: ReleaseEnvironment, plan: Pick<ReleasePlan, 'from' | 'commits'>, version: string, date?: string) {
    const repositoryUrl = getRepositoryUrl(environment.cwd, environment.env)
    return renderReleaseNotes({
        version,
        ...(plan.from ? { previousTag: plan.from } : {}),
        date: date ?? new Date().toISOString().slice(0, 10),
        ...(repositoryUrl ? { repositoryUrl } : {}),
        commits: plan.commits
    })
}

/** Plans the next release of the checked-out commit without changing anything. */
export async function planRelease(options: PlanReleaseOptions = {}, environmentOptions: Partial<ReleaseEnvironment> = {}): Promise<ReleasePlan> {
    const environment = createEnvironment(environmentOptions)
    const { cwd } = environment
    const project = await loadProjectPolicy(cwd, options.mode ? { mode: options.mode } : {})
    const branch = await getBranch(environment, options.branch)
    const channel = getReleaseChannel(branch) ?? (options.fallbackToMain ? getReleaseChannel('main') : undefined)
    const head = await git(environment, ['rev-parse', 'HEAD'])
    const packages = getReleasePackages(cwd)
    const base: ReleasePlan = {
        branch,
        head,
        mode: project.policy.mode,
        release: false,
        commits: [],
        packages,
        ...(project.policy.assets ? { assets: project.policy.assets } : {})
    }
    if (!channel) return base

    if (await git(environment, ['rev-parse', '--is-shallow-repository']) === 'true') {
        throw new Error('The repository is a shallow clone, so its tags and commits are incomplete. Fetch the full history, such as `fetch-depth: 0` in actions/checkout.')
    }
    const ignored = new Set(options.ignoreTags ?? [])
    const reachable = lines(await git(environment, ['tag', '--list', 'v*', '--merged', 'HEAD'])).filter((tag) => !ignored.has(tag))
    const all = lines(await git(environment, ['tag', '--list', 'v*'])).filter((tag) => !ignored.has(tag))
    const from = getBaseTag(channel, reachable)
    const decision = resolveRelease(
        getRangeCommits(cwd, from, 'HEAD'),
        project.policy,
        project.isReleasePath ? { isReleasePath: project.isReleasePath } : {}
    )
    const plan: ReleasePlan = { ...base, channel, ...(from ? { from } : {}), release: decision.release, commits: decision.commits }
    if (!decision.release) return plan

    const version = options.version ?? getNextVersion(channel, decision.release, { reachable, all })
    return { ...plan, version, tag: toVersionTag(version), notes: renderPlanNotes(environment, plan, version, options.date) }
}

/** `.npmrc` content that applies in a repository: the project file, then the user file, as npm reads them. */
function readNpmConfigs(cwd: string, env: NodeJS.ProcessEnv) {
    const userconfig = env.NPM_CONFIG_USERCONFIG ?? env.npm_config_userconfig ?? path.join(os.homedir(), '.npmrc')
    return { project: readNpmrc(path.join(cwd, '.npmrc')), user: readNpmrc(userconfig) }
}

/** The last value of an `.npmrc` key, with `${VAR}` and `${VAR?}` expanded, or `undefined`. */
function readNpmrcValue(content: string, key: string, env: NodeJS.ProcessEnv) {
    let value: string | undefined
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue
        const index = trimmed.indexOf('=')
        if (index === -1 || trimmed.slice(0, index).trim() !== key) continue
        value = trimmed.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
            .replace(/\$\{([^}?]+)\??\}/g, (_, name: string) => env[name] ?? '')
    }
    return value
}

/**
 * Registry of a package, in npm's order: `publishConfig` (scoped, then plain),
 * the `@scope:registry` of `.npmrc` or the environment, `npm_config_registry`,
 * the `registry` of `.npmrc`, then npm. Pass `npmrc` to read `.npmrc` settings.
 */
export function getRegistry(manifest: PackageJson, env: NodeJS.ProcessEnv = process.env, npmrc = '') {
    const scope = manifest.name?.startsWith('@') ? manifest.name.split('/')[0] : undefined
    const candidates = [
        scope ? manifest.publishConfig?.[`${scope}:registry`] : undefined,
        manifest.publishConfig?.registry,
        scope ? env[`npm_config_${scope}:registry`] ?? env[`NPM_CONFIG_${scope}:registry`] : undefined,
        scope ? readNpmrcValue(npmrc, `${scope}:registry`, env) : undefined,
        env.NPM_CONFIG_REGISTRY ?? env.npm_config_registry,
        readNpmrcValue(npmrc, 'registry', env)
    ]
    const configured = candidates.find((value) => typeof value === 'string' && value)
    const registry = typeof configured === 'string' ? configured : officialRegistry
    return registry.endsWith('/') ? registry : `${registry}/`
}

function nerfDart(registry: string) {
    const url = new URL(registry)
    return `//${url.host}${url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`}`
}

interface PublishedVersion {
    gitHead?: string
    dist?: { attestations?: unknown }
}

interface Packument {
    'dist-tags'?: Record<string, string>
    versions?: Record<string, PublishedVersion>
}

function isTransient(status: number) {
    return status === 408 || status === 429 || status >= 500
}

async function readPackument(environment: ReleaseEnvironment, registry: string, name: string): Promise<Packument | undefined> {
    const headers: Record<string, string> = { accept: 'application/json', 'cache-control': 'no-cache' }
    // Private registries need auth to read; the public npm registry does not.
    if (registry !== officialRegistry && environment.env.NPM_TOKEN) headers.authorization = `Bearer ${environment.env.NPM_TOKEN}`
    for (let attempt = 1; ; attempt++) {
        let response: Response
        try {
            response = await environment.fetch(`${registry}${name.replace('/', '%2f')}`, { headers })
        } catch (error) {
            if (attempt >= 4) throw new Error(`Could not read ${name} from ${registry}: ${(error as Error).message}`, { cause: error })
            await environment.wait(2_000 * attempt)
            continue
        }
        if (response.status === 404) return undefined
        if (response.ok) return await response.json() as Packument
        if (!isTransient(response.status) || attempt >= 4) {
            throw new Error(`Could not read ${name} from ${registry}: ${response.status} ${response.statusText}`)
        }
        await environment.wait(2_000 * attempt)
    }
}

async function getGitHubIdToken(environment: ReleaseEnvironment, audience: string) {
    const { ACTIONS_ID_TOKEN_REQUEST_URL: url, ACTIONS_ID_TOKEN_REQUEST_TOKEN: token } = environment.env
    if (!url || !token) return undefined
    const response = await environment.fetch(`${url}${url.includes('?') ? '&' : '?'}audience=${encodeURIComponent(audience)}`, {
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' }
    })
    if (!response.ok) {
        environment.log(`! Could not get a GitHub Actions OIDC token: ${response.status} ${response.statusText}`)
        return undefined
    }
    return (await response.json() as { value?: string }).value
}

/** Exchanges a GitHub Actions OIDC token for a short-lived npm publish token (npm trusted publishing). */
export async function exchangeOidcToken(environment: ReleaseEnvironment, name: string, registry: string) {
    if (registry !== officialRegistry) return undefined
    const identity = environment.env.NPM_ID_TOKEN || await getGitHubIdToken(environment, 'npm:registry.npmjs.org')
    if (!identity) return undefined
    // The same escaping as the npm CLI: `@scope%2fname`.
    const response = await environment.fetch(`${officialRegistry}-/npm/v1/oidc/token/exchange/package/${name.replace('/', '%2f')}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${identity}` }
    })
    if (!response.ok) {
        environment.log(`! Could not exchange the OIDC token for ${name}: ${response.status} ${response.statusText}`)
        return undefined
    }
    return (await response.json() as { token?: string }).token
}

function readNpmrc(file: string) {
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}

/** actions/setup-node writes `_authToken=${NODE_AUTH_TOKEN}` and sets this placeholder when no token is given. */
const placeholderToken = 'XXXXX-XXXXX-XXXXX-XXXXX'

/**
 * Auth for the registry in `.npmrc` content: `valid`, `invalid` (an unset
 * `${VAR}` or the setup-node placeholder), or `undefined` when there is none.
 * npm 9+ rejects auth without a registry prefix, so only `//host/path/:` keys count.
 */
function readRegistryAuth(content: string, registry: string, env: NodeJS.ProcessEnv) {
    const nerfed = nerfDart(registry)
    const usable = (value: string | undefined) => value === undefined ? undefined : Boolean(value) && value !== placeholderToken
    const token = usable(readNpmrcValue(content, `${nerfed}:_authToken`, env))
    const auth = usable(readNpmrcValue(content, `${nerfed}:_auth`, env))
    const username = usable(readNpmrcValue(content, `${nerfed}:username`, env))
    const password = usable(readNpmrcValue(content, `${nerfed}:_password`, env))
    if (token || auth || (username && password)) return 'valid'
    if (token === false || auth === false || username === false || password === false) return 'invalid'
    return undefined
}

/** Whether `.npmrc` content has usable auth for the registry. */
export function hasRegistryAuth(content: string, registry: string, env: NodeJS.ProcessEnv = process.env) {
    return readRegistryAuth(content, registry, env) === 'valid'
}

let npmrcCount = 0

interface NpmAuth {
    env: NodeJS.ProcessEnv
    source: 'npmrc' | 'oidc' | 'token'
}

/**
 * npm environment for one npm command: existing `.npmrc` auth, then npm trusted
 * publishing through GitHub Actions OIDC, then `NPM_TOKEN`. An OIDC token
 * authorizes one registry route, so every command exchanges its own.
 *
 * npm reads the project `.npmrc` before the user config, so a project
 * `_authToken=${NPM_TOKEN}` would win over a token in the user config. Both
 * files go into one temporary user config instead, the token last, and npm
 * runs outside the repository.
 */
async function createNpmEnv(environment: ReleaseEnvironment, name: string, registry: string, directory: string, skipOidc = false): Promise<NpmAuth> {
    const { project, user } = readNpmConfigs(environment.cwd, environment.env)
    const config = [user.trim(), project.trim()].filter(Boolean).join('\n')
    const write = (content: string) => {
        const file = path.join(directory, `${name.replace(/[@/]/g, '_')}-${++npmrcCount}.npmrc`)
        fs.writeFileSync(file, `${content}\n`, { mode: 0o600 })
        return { ...environment.env, NPM_CONFIG_USERCONFIG: file }
    }
    const existing = readRegistryAuth(project, registry, environment.env) ?? readRegistryAuth(user, registry, environment.env)
    if (existing === 'valid') return { env: write(config), source: 'npmrc' }

    const oidc = skipOidc ? undefined : await exchangeOidcToken(environment, name, registry)
    const token = oidc ?? environment.env.NPM_TOKEN
    if (!token) {
        throw new Error(`No npm auth for ${name}. Configure npm trusted publishing with \`id-token: write\`, set NPM_TOKEN, or add auth to .npmrc for ${registry}.`)
    }
    return { env: write(`${config}\n${nerfDart(registry)}:_authToken=${token}`.trim()), source: oidc ? 'oidc' : 'token' }
}

function detectIndent(content: string) {
    return /^([ \t]+)"/m.exec(content)?.[1] ?? '    '
}

export interface ReleaseManifestOptions {
    /** Names of the packages released together; their ranges must accept the release version. */
    internal?: string[]
    /** The root `repository`, written into a workspace package that has none, for npm provenance. */
    repository?: unknown
}

/** A range for `version` in the style of `range`: exact, `~`, or `^`. */
function rangeFor(range: string, version: string) {
    if (semver.valid(range)) return version
    return range.trim().startsWith('~') ? `~${version}` : `^${version}`
}

/**
 * Writes the release version and git head into a package manifest. Versions are
 * never committed, so ranges on packages of the same release, such as `^0.0.0`,
 * are moved to the release version when they do not accept it.
 */
export function writeReleaseManifest(cwd: string, dir: string, version: string, gitHead: string, options: ReleaseManifestOptions = {}) {
    const file = path.join(cwd, dir, 'package.json')
    const content = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
    const manifest = JSON.parse(content) as PackageJson
    manifest.version = version
    manifest.gitHead = gitHead
    for (const field of dependencyFields) {
        const dependencies = manifest[field] as Record<string, string> | undefined
        for (const [name, range] of Object.entries(dependencies ?? {})) {
            if (!options.internal?.includes(name) || !semver.validRange(range)) continue
            if (!semver.satisfies(version, range, { includePrerelease: true })) dependencies![name] = rangeFor(range, version)
        }
    }
    if (dir !== '.' && !manifest.repository && options.repository) {
        const root = options.repository
        manifest.repository = typeof root === 'string'
            ? { type: 'git', url: root, directory: dir }
            : { ...root as Record<string, unknown>, directory: dir }
    }
    fs.writeFileSync(file, `${JSON.stringify(manifest, null, detectIndent(content))}\n`)
    return manifest
}

/** Yarn 1 names the tarball with `--filename`; Yarn 2+ uses `--out`. */
async function isYarnClassic(environment: ReleaseEnvironment, env: NodeJS.ProcessEnv) {
    const declared = /^yarn@(\d+)/.exec(String(readJson<PackageJson>(path.join(environment.cwd, 'package.json')).packageManager ?? ''))
    if (declared) return declared[1] === '1'
    const { stdout } = await environment.run('yarn', ['--version'], { cwd: environment.cwd, env })
    return stdout.trim().startsWith('1.')
}

async function packCommand(environment: ReleaseEnvironment, packageManager: PackageManager, destination: string, env: NodeJS.ProcessEnv): Promise<[string, string[]]> {
    switch (packageManager) {
        case 'bun':
            return ['bun', ['pm', 'pack', '--destination', destination, '--quiet']]
        case 'pnpm':
            return ['pnpm', ['pack', '--pack-destination', destination]]
        case 'yarn':
            return ['yarn', ['pack', await isYarnClassic(environment, env) ? '--filename' : '--out', path.join(destination, 'package.tgz')]]
        default:
            return ['npm', ['pack', '--pack-destination', destination]]
    }
}

/** Reads `package/package.json` from a packed tarball. */
export function readPackedManifest(tarball: string): PackageJson {
    const archive = gunzipSync(fs.readFileSync(tarball))
    let offset = 0
    let longName: string | undefined
    while (offset + 512 <= archive.length) {
        const header = archive.subarray(offset, offset + 512)
        if (header.every((byte) => byte === 0)) break
        const field = (start: number, length: number) => header.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '')
        const size = parseInt(field(124, 12).trim() || '0', 8)
        const type = field(156, 1)
        const prefix = field(345, 155)
        const name = longName ?? (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100))
        const body = archive.subarray(offset + 512, offset + 512 + size)
        longName = undefined
        if (type === 'L') {
            longName = body.toString('utf8').replace(/\0.*$/s, '')
        } else if (type === 'x') {
            const pathRecord = /\d+ path=([^\n]+)\n/.exec(body.toString('utf8'))
            if (pathRecord) longName = pathRecord[1]
        } else if (name.replace(/^\.\//, '').split('/').slice(1).join('/') === 'package.json') {
            return JSON.parse(body.toString('utf8').replace(/^\uFEFF/, '')) as PackageJson
        }
        offset += 512 + Math.ceil(size / 512) * 512
    }
    throw new Error(`${tarball} has no package.json.`)
}

/** Local protocols that only resolve inside the repository. */
const localProtocols = /^(?:workspace|file|link|portal|catalog):/

function validatePackedManifest(manifest: PackageJson, pkg: ReleasePackage, version: string, gitHead: string, internal: string[]) {
    if (manifest.name !== pkg.name) throw new Error(`The tarball of ${pkg.dir} is ${manifest.name}, not ${pkg.name}.`)
    if (manifest.version !== version) throw new Error(`The tarball of ${pkg.name} has version ${manifest.version}, not ${version}.`)
    if (manifest.gitHead !== gitHead) throw new Error(`The tarball of ${pkg.name} has gitHead ${String(manifest.gitHead)}, not ${gitHead}.`)
    for (const field of dependencyFields) {
        for (const [name, range] of Object.entries((manifest[field] ?? {}) as Record<string, string>)) {
            if (localProtocols.test(range)) throw new Error(`The tarball of ${pkg.name} keeps \`${name}: ${range}\` in ${field}.`)
            if (internal.includes(name) && semver.validRange(range) && !semver.satisfies(version, range, { includePrerelease: true })) {
                throw new Error(`The tarball of ${pkg.name} has \`${name}: ${range}\` in ${field}, which does not accept the release version ${version}.`)
            }
        }
    }
}

async function waitForVersion(environment: ReleaseEnvironment, registry: string, name: string, version: string) {
    for (let attempt = 1; attempt <= 30; attempt++) {
        const published = (await readPackument(environment, registry, name))?.versions?.[version]
        if (published) return published
        await environment.wait(10_000)
    }
    throw new Error(`${name}@${version} did not appear on ${registry}.`)
}

export type GitHubReleaseAsset = ReleaseAsset

export interface GitHubRelease {
    tag: string
    notes: string
    prerelease: boolean
    /** The commit to tag when the tag does not exist on GitHub yet. */
    target?: string
    /** Whether the release becomes the repository's latest; defaults to every non-prerelease. */
    latest?: boolean
    /** Files to attach. A rerun uploads only the assets the release does not have yet. */
    assets?: GitHubReleaseAsset[]
}

interface GitHubReleaseResponse {
    html_url?: string
    upload_url?: string
    assets?: Array<{ name: string }>
}

function fillAssetName(template: string, tag: string) {
    return template.replaceAll('{tag}', tag).replaceAll('{version}', tag.replace(/^v/, ''))
}

/** Resolves asset files and names, and fails before any GitHub write when a file is missing. */
function resolveAssets(cwd: string, tag: string, assets: GitHubReleaseAsset[] = []) {
    const resolved = assets.map((asset) => {
        const file = path.resolve(cwd, asset.path)
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`The GitHub release asset ${asset.path} does not exist.`)
        return {
            file,
            name: fillAssetName(asset.name ?? path.basename(file), tag),
            ...(asset.label ? { label: fillAssetName(asset.label, tag) } : {})
        }
    })
    const names = new Set<string>()
    for (const { name } of resolved) {
        if (names.has(name)) throw new Error(`Two GitHub release assets are named ${name}.`)
        names.add(name)
    }
    return resolved
}

async function uploadAssets(environment: ReleaseEnvironment, release: GitHubReleaseResponse, assets: ReturnType<typeof resolveAssets>, headers: Record<string, string>) {
    if (!assets.length) return
    if (!release.upload_url) throw new Error('The GitHub release has no upload URL for its assets.')
    const uploadUrl = release.upload_url.replace(/\{.*\}$/, '')
    const existing = new Set((release.assets ?? []).map(({ name }) => name))
    for (const asset of assets) {
        if (existing.has(asset.name)) {
            environment.log(`✓ GitHub release asset ${asset.name} exists.`)
            continue
        }
        const query = `name=${encodeURIComponent(asset.name)}${asset.label ? `&label=${encodeURIComponent(asset.label)}` : ''}`
        const response = await environment.fetch(`${uploadUrl}?${query}`, {
            method: 'POST',
            headers: { ...headers, 'content-type': 'application/octet-stream' },
            body: fs.readFileSync(asset.file)
        })
        if (!response.ok) throw new Error(`Could not upload ${asset.name} to the GitHub release: ${response.status} ${await response.text()}`)
        environment.log(`✓ Uploaded ${asset.name}`)
    }
}

/** Cuts notes at a line to fit a GitHub release body, keeping the full changelog link. */
export function truncateNotes(notes: string, limit = releaseBodyLimit) {
    if (notes.length <= limit) return notes
    const footer = /\n\n(\*\*Full Changelog\*\*: \S+)\n?$/.exec(notes)?.[1]
    const note = `…the notes are too long for a GitHub release${footer ? '; see the full changelog' : ''}.`
    const tail = `\n\n${note}${footer ? `\n\n${footer}` : ''}\n`
    const cut = notes.slice(0, Math.max(0, limit - tail.length))
    const end = cut.lastIndexOf('\n')
    return `${(end > 0 ? cut.slice(0, end) : cut).trimEnd()}${tail}`
}

/** Creates the GitHub release of a tag unless it exists. Needs `GITHUB_TOKEN` and the repository. */
export async function publishGitHubRelease(environment: ReleaseEnvironment, release: GitHubRelease) {
    const token = environment.env.GITHUB_TOKEN ?? environment.env.GH_TOKEN
    const repositoryUrl = getRepositoryUrl(environment.cwd, environment.env)
    const repository = repositoryUrl?.replace(/^https?:\/\/[^/]+\//, '')
    if (!token || !repository) {
        environment.log('! Skip the GitHub release: set GITHUB_TOKEN and a GitHub repository URL.')
        return undefined
    }
    const api = `${(environment.env.GITHUB_API_URL ?? 'https://api.github.com').replace(/\/+$/, '')}/repos/${repository}/releases`
    const headers = {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'x-github-api-version': '2022-11-28'
    }
    const assets = resolveAssets(environment.cwd, release.tag, release.assets)
    const existing = await environment.fetch(`${api}/tags/${encodeURIComponent(release.tag)}`, { headers })
    if (existing.ok) {
        environment.log(`✓ GitHub release ${release.tag} exists.`)
        const found = await existing.json() as GitHubReleaseResponse
        await uploadAssets(environment, found, assets, headers)
        return found.html_url
    }
    if (existing.status !== 404) {
        throw new Error(`Could not check the GitHub release ${release.tag}: ${existing.status} ${await existing.text()}`)
    }
    const latest = release.latest ?? !release.prerelease
    const response = await environment.fetch(api, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            tag_name: release.tag,
            ...(release.target ? { target_commitish: release.target } : {}),
            name: release.tag,
            body: truncateNotes(release.notes),
            prerelease: release.prerelease,
            make_latest: latest ? 'true' : 'false'
        })
    })
    if (!response.ok) throw new Error(`Could not create the GitHub release ${release.tag}: ${response.status} ${await response.text()}`)
    const created = await response.json() as GitHubReleaseResponse
    environment.log(`✓ Created the GitHub release ${created.html_url ?? release.tag}.`)
    await uploadAssets(environment, created, assets, headers)
    return created.html_url
}

export interface ReleaseOptions extends PlanReleaseOptions {
    /** Plans and prints the release without changing anything. */
    dryRun?: boolean
    /**
     * The version a reviewer approved, such as `1.2.4` or `v1.2.4`. The release stops before
     * publishing anything when it would release another version, or nothing.
     */
    expectVersion?: string
}

export interface ReleaseResult {
    status: 'skipped' | 'none' | 'dry-run' | 'released' | 'resumed'
    plan: ReleasePlan
}

function describePlan(plan: ReleasePlan) {
    const range = plan.from ? `${plan.from}..${plan.head.slice(0, 9)}` : `all commits up to ${plan.head.slice(0, 9)}`
    return [
        `Branch: ${plan.branch}${plan.channel ? ` (npm dist-tag ${plan.channel.distTag})` : ''}`,
        `Mode: ${plan.mode}`,
        `Range: ${range}`,
        ...plan.commits.map((decision) => `  ${(decision.release || 'none').padEnd(5)} ${decision.hash?.slice(0, 9) ?? ''} ${decision.header}`),
        `Release: ${plan.release || 'none'}${plan.version ? ` → ${plan.version}` : ''}`,
        `Packages: ${plan.packages.map(({ name }) => name).join(', ') || 'none'}`
    ].join('\n')
}

/** Whether a stable version is the highest stable version tagged in the repository. */
async function isLatestStable(environment: ReleaseEnvironment, version: string) {
    const versions = lines(await git(environment, ['tag', '--list', 'v*'])).flatMap((tag) => parseVersionTag(tag) ?? [])
    return !versions.some((other) => !semver.prerelease(other) && semver.gt(other, version))
}

/**
 * Why HEAD cannot release on its branch, or `undefined` when it can: HEAD must be on the
 * remote-tracking branch (`origin/<branch>`), or on the local branch when there is no remote one,
 * so a detached commit from another branch never releases as the release branch.
 */
async function checkOnReleaseBranch(environment: ReleaseEnvironment, plan: ReleasePlan) {
    const commit = plan.head.slice(0, 9)
    for (const ref of [`refs/remotes/origin/${plan.branch}`, `refs/heads/${plan.branch}`]) {
        if (!await gitSucceeds(environment, ['rev-parse', '--verify', '--quiet', ref])) continue
        if (await gitSucceeds(environment, ['merge-base', '--is-ancestor', 'HEAD', ref])) return undefined
        const remote = ref.startsWith('refs/remotes/')
        return `${commit} is not on ${remote ? 'origin/' : ''}${plan.branch}. ${remote ? `Push it to ${plan.branch} first, or release` : 'Release'} a commit of ${plan.branch}.`
    }
    return `The ${plan.branch} branch is not in this clone, so aronrepo cannot check that ${commit} is on it. Fetch it, such as \`fetch-depth: 0\` in actions/checkout.`
}

/** Why a release of `version` does not match the approved version, or `undefined` when it does. */
function checkExpectedVersion(options: ReleaseOptions, version: string | undefined) {
    if (!options.expectVersion) return undefined
    // `semver.valid` drops a `v` and spaces, as the version check at the start accepts them.
    const expected = semver.valid(options.expectVersion) ?? options.expectVersion
    if (expected === version) return undefined
    return version
        ? `This release is ${version}, not the expected ${expected}. Review the plan again.`
        : `Nothing releases, but ${expected} was expected. Review the plan again.`
}

/** Pushes a version tag without the repository's pre-push hooks, which would run after npm already published. */
async function pushTag(environment: ReleaseEnvironment, tag: string) {
    await git(environment, ['push', '--no-verify', 'origin', `refs/tags/${tag}`])
}

/** Finishes a release whose tag points at HEAD: pushes the tag and creates a missing GitHub release. */
async function resumeTaggedRelease(environment: ReleaseEnvironment, options: ReleaseOptions, plan: ReleasePlan) {
    const channel = plan.channel
    if (!channel) return false
    const tags = lines(await git(environment, ['tag', '--list', 'v*', '--points-at', 'HEAD']))
    const tag = tags.find((candidate) => {
        const version = parseVersionTag(candidate)
        if (!version) return false
        const prerelease = semver.prerelease(version)
        return channel.prerelease ? prerelease?.[0] === channel.prerelease : !prerelease
    })
    if (!tag || options.dryRun) return false
    // The tag's own version, so a later prerelease of the same version does not renumber it.
    const previous = await planRelease({ ...options, ignoreTags: [tag], version: parseVersionTag(tag)! }, environment)
    if (!previous.notes) return false
    const problem = await checkOnReleaseBranch(environment, plan) ?? checkExpectedVersion(options, previous.version)
    if (problem) throw new Error(problem)
    environment.log(`${tag} points at HEAD; make sure the tag is pushed and its GitHub release exists.`)
    await pushTag(environment, tag)
    await publishGitHubRelease(environment, {
        tag,
        notes: previous.notes,
        prerelease: Boolean(channel.prerelease),
        target: plan.head,
        ...(plan.assets ? { assets: plan.assets } : {}),
        latest: !channel.prerelease && await isLatestStable(environment, previous.version!)
    })
    return true
}

/** The next version to try when one is taken: the next patch, or the next prerelease number. */
function nextFreeVersion(version: string) {
    return semver.prerelease(version) ? semver.inc(version, 'prerelease')! : semver.inc(version, 'patch')!
}

/**
 * Releases the checked-out commit:
 *
 * 1. plan the version from the commits since the channel's last tag;
 * 2. write the version and git head into every published package and pack it;
 * 3. publish each package, in dependency order, on the `aronrepo-staging`
 *    dist-tag, skipping versions already published from the same commit;
 * 4. wait until the registry serves every package, then move the channel's
 *    dist-tag to the new version;
 * 5. push the version tag and create the GitHub release.
 *
 * Every step checks what an interrupted run already did, so rerunning the job
 * finishes a release instead of skipping or duplicating it.
 */
export async function runRelease(options: ReleaseOptions = {}, environmentOptions: Partial<ReleaseEnvironment> = {}): Promise<ReleaseResult> {
    if (options.expectVersion && !semver.valid(options.expectVersion)) {
        throw new Error(`The expected version ${options.expectVersion} is not a version, such as 1.2.4.`)
    }
    const environment = createEnvironment(environmentOptions)
    const { cwd, log } = environment
    const plan = await planRelease(options, environment)
    log(describePlan(plan))

    if (!plan.channel) {
        log(`Branch ${plan.branch} does not release. Release branches: main, alpha, beta, rc, canary.`)
        return { status: 'skipped', plan }
    }
    if (!plan.version || !plan.tag || !plan.notes) {
        if (await resumeTaggedRelease(environment, options, plan)) return { status: 'resumed', plan }
        const unexpected = checkExpectedVersion(options, undefined)
        if (unexpected && !options.dryRun) throw new Error(unexpected)
        if (unexpected) log(`! ${unexpected} A release would stop here.`)
        log('No release.')
        return { status: 'none', plan }
    }
    if (!plan.packages.length) throw new Error('No published package found. Add `"publishConfig": { "access": "public" }` to the packages that ship.')
    for (const pkg of plan.packages) {
        if (pkg.name.startsWith('@') && !pkg.manifest.publishConfig?.access) {
            throw new Error(`${pkg.name} is scoped, and npm publishes scoped packages as restricted by default. Set \`publishConfig.access\` in ${pkg.dir}/package.json.`)
        }
    }

    const dirty = await git(environment, ['status', '--porcelain'])
    const existingTag = await git(environment, ['tag', '--list', plan.tag])
    if (existingTag && await gitSucceeds(environment, ['merge-base', '--is-ancestor', 'HEAD', plan.tag])) {
        log(`${plan.tag} is on a newer commit of ${plan.branch}; this commit is already released.`)
        return { status: 'none', plan }
    }
    const offBranch = await checkOnReleaseBranch(environment, plan)
    if (options.dryRun) {
        try {
            resolveAssets(cwd, plan.tag, plan.assets)
        } catch (error) {
            log(`! ${(error as Error).message} A release would stop here.`)
        }
        for (const problem of [offBranch, checkExpectedVersion(options, plan.version)]) {
            if (problem) log(`! ${problem} A release would stop here.`)
        }
        if (dirty) log('! The working tree has changes; a release would stop here.')
        if (existingTag) log(`! ${plan.tag} exists but is not reachable from ${plan.branch}; a release would stop here.`)
        log(`\nDry run: would publish ${plan.tag} on ${plan.channel.distTag}.\n\n${plan.notes}`)
        return { status: 'dry-run', plan }
    }
    if (offBranch) throw new Error(offBranch)
    if (dirty) throw new Error('The working tree has changes. Release from a clean checkout.')
    if (existingTag) throw new Error(`${plan.tag} exists but is not reachable from ${plan.branch}.`)
    // A missing asset would fail the GitHub release after npm already published.
    resolveAssets(cwd, plan.tag, plan.assets)

    const npmrc = (() => {
        const { project, user } = readNpmConfigs(cwd, environment.env)
        return `${user}\n${project}`
    })()
    const registryOf = (pkg: ReleasePackage) => getRegistry(pkg.manifest, environment.env, npmrc)

    // A version published from another commit without its tag comes from an interrupted
    // release; npm never reuses a version, so this release takes the next free one.
    let version = plan.version
    for (let attempt = 0; ; attempt++) {
        const taken: string[] = []
        for (const pkg of plan.packages) {
            const published = (await readPackument(environment, registryOf(pkg), pkg.name))?.versions?.[version]
            if (!published || published.gitHead === plan.head) continue
            if (!published.gitHead) {
                throw new Error(`${pkg.name}@${version} is already published without a gitHead, so aronrepo cannot tell which commit it came from. Tag that commit ${toVersionTag(version)}, or publish a newer version.`)
            }
            taken.push(`${pkg.name}@${version} (${published.gitHead.slice(0, 9)})`)
        }
        if (!taken.length) break
        if (attempt >= 20 || await git(environment, ['tag', '--list', toVersionTag(nextFreeVersion(version))])) {
            throw new Error(`${taken.join(', ')} is already published from another commit, not ${plan.head}.`)
        }
        const next = nextFreeVersion(version)
        log(`! ${taken.join(', ')} is already published from another commit without a ${toVersionTag(version)} tag; releasing ${next} instead.`)
        version = next
    }
    // A version taken by an interrupted release is not the one the reviewer approved.
    const unexpected = checkExpectedVersion(options, version)
    if (unexpected) throw new Error(unexpected)
    if (version !== plan.version) {
        plan.version = version
        plan.tag = toVersionTag(version)
        plan.notes = renderPlanNotes(environment, plan, version, options.date)
    }
    const { tag, notes, channel } = { tag: plan.tag, notes: plan.notes, channel: plan.channel }

    for (const pkg of plan.packages) {
        const packument = await readPackument(environment, registryOf(pkg), pkg.name)
        const current = packument?.['dist-tags']?.[channel.distTag]
        if (current && semver.valid(current) && semver.gt(current, version)) {
            throw new Error(`${pkg.name} has ${current} on ${channel.distTag}, newer than ${version}. Tag the commit of ${current} as ${toVersionTag(current)} so releases continue from it.`)
        }
        if (!packument && channel.prerelease) {
            log(`! ${pkg.name} is new; npm also points \`latest\` at its first version, ${version}.`)
        }
    }

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-release-'))
    const manifests = new Map(plan.packages.map(({ dir }) => {
        const file = path.join(cwd, dir, 'package.json')
        return [file, fs.readFileSync(file, 'utf8')]
    }))
    let restored = false
    const restore = () => {
        if (restored) return
        restored = true
        fs.rmSync(directory, { recursive: true, force: true })
        // Versions live in tags and on the registry, not in the repository.
        for (const [file, content] of manifests) fs.writeFileSync(file, content)
    }
    // A cancelled job still restores the manifests and removes the temporary npm configs with tokens.
    const onSignal = (signal: NodeJS.Signals) => {
        restore()
        process.kill(process.pid, signal)
    }
    process.once('SIGINT', onSignal)
    process.once('SIGTERM', onSignal)

    const runNpm = async (pkg: ReleasePackage, args: string[]) => {
        const registry = registryOf(pkg)
        const command = [...args, '--registry', registry]
        const auth = await createNpmEnv(environment, pkg.name, registry, directory)
        try {
            return await environment.run('npm', command, { cwd: directory, env: auth.env })
        } catch (error) {
            // A trusted publisher without dist-tag permission rejects `npm dist-tag`; NPM_TOKEN may still have it.
            if (auth.source !== 'oidc' || !environment.env.NPM_TOKEN) throw error
            log(`! \`npm ${args[0]}\` failed with the trusted publishing token; retrying with NPM_TOKEN.`)
            const fallback = await createNpmEnv(environment, pkg.name, registry, directory, true)
            return await environment.run('npm', command, { cwd: directory, env: fallback.env })
        }
    }

    try {
        const packageManager = detectPackageManager(cwd)
        const internal = plan.packages.map(({ name }) => name)
        const repository = (() => {
            const root = path.join(cwd, 'package.json')
            return fs.existsSync(root) ? readJson<PackageJson>(root).repository : undefined
        })()
        // Every version must be written before packing, so workspace ranges resolve to it.
        for (const pkg of plan.packages) {
            pkg.manifest = writeReleaseManifest(cwd, pkg.dir, version, plan.head, { internal, repository })
        }

        const packEnv = withoutSecrets(environment.env)
        const tarballs = new Map<string, string>()
        for (const [index, pkg] of plan.packages.entries()) {
            const destination = path.join(directory, String(index))
            fs.mkdirSync(destination)
            const [command, args] = await packCommand(environment, packageManager, destination, packEnv)
            await environment.run(command, args, { cwd: path.join(cwd, pkg.dir), env: packEnv })
            const tarball = fs.readdirSync(destination).find((file) => file.endsWith('.tgz'))
            if (!tarball) throw new Error(`Packing ${pkg.name} produced no tarball.`)
            const file = path.join(destination, tarball)
            validatePackedManifest(readPackedManifest(file), pkg, version, plan.head, internal)
            tarballs.set(pkg.name, file)
            log(`✓ Packed ${pkg.name}@${version}`)
        }

        for (const pkg of plan.packages) {
            const registry = registryOf(pkg)
            const isPublished = async () => (await readPackument(environment, registry, pkg.name))?.versions?.[version]?.gitHead === plan.head
            if (await isPublished()) {
                log(`✓ ${pkg.name}@${version} is already published from this commit.`)
                continue
            }
            const args = ['publish', tarballs.get(pkg.name)!, '--tag', stagingDistTag]
            if (pkg.manifest.publishConfig?.access) args.push('--access', String(pkg.manifest.publishConfig.access))
            if (pkg.manifest.publishConfig?.provenance) args.push('--provenance')
            try {
                await runNpm(pkg, args)
            } catch (error) {
                // A stale registry cache can hide a version that an earlier run published; npm then refuses to publish over it.
                await environment.wait(5_000)
                if (!await isPublished()) throw error
                log(`✓ ${pkg.name}@${version} was already published from this commit.`)
                continue
            }
            log(`✓ Published ${pkg.name}@${version} on ${stagingDistTag}`)
        }

        for (const pkg of plan.packages) {
            const registry = registryOf(pkg)
            const published = await waitForVersion(environment, registry, pkg.name, version)
            if (pkg.manifest.publishConfig?.provenance && !published.dist?.attestations) {
                log(`! ${pkg.name}@${version} has no provenance attestation on ${registry}.`)
            }
        }

        for (const pkg of plan.packages) {
            const tags = (await readPackument(environment, registryOf(pkg), pkg.name))?.['dist-tags'] ?? {}
            if (tags[channel.distTag] !== version) {
                await runNpm(pkg, ['dist-tag', 'add', `${pkg.name}@${version}`, channel.distTag])
            }
            if (tags[stagingDistTag]) {
                await runNpm(pkg, ['dist-tag', 'rm', pkg.name, stagingDistTag])
                    .catch((error: Error) => log(`! Could not remove the ${stagingDistTag} dist-tag of ${pkg.name}: ${error.message}`))
            }
            log(`✓ ${pkg.name}@${version} is on ${channel.distTag}`)
        }
    } finally {
        process.removeListener('SIGINT', onSignal)
        process.removeListener('SIGTERM', onSignal)
        restore()
    }

    // A signing config would open an editor or fail after npm already published.
    await git(environment, ['-c', 'tag.gpgSign=false', 'tag', tag, plan.head])
    await pushTag(environment, tag)
    log(`✓ Pushed ${tag}`)

    await publishGitHubRelease(environment, {
        tag,
        notes,
        prerelease: Boolean(channel.prerelease),
        target: plan.head,
        ...(plan.assets ? { assets: plan.assets } : {}),
        latest: !channel.prerelease && await isLatestStable(environment, version)
    })
    return { status: 'released', plan }
}
