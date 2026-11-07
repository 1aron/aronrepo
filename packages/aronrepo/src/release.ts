import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import type { ReleaseType } from './commits'
import { renderReleaseNotes } from './notes'
import { resolveRelease, type CommitDecision, type ReleasePolicy } from './policy'
import {
    detectPackageManager,
    getRangeCommits,
    loadProjectPolicy,
    queryPublicWorkspaceDirs,
    readWorkspacePatterns,
    type PackageJson,
    type PackageManager
} from './project'
import {
    getBaseTag,
    getNextVersion,
    getReleaseChannel,
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

export const runCommand: Runner = (command, args, { cwd, env }) => new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
        if (code === 0) resolve({ stdout, stderr })
        else reject(new Error(`\`${command} ${args.join(' ')}\` exited with ${code}.\n${stderr.trim() || stdout.trim()}`))
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

async function git(environment: ReleaseEnvironment, args: string[]) {
    return (await environment.run('git', args, { cwd: environment.cwd, env: environment.env })).stdout.trim()
}

function lines(output: string) {
    return output.split('\n').map((line) => line.trim()).filter(Boolean)
}

export interface ReleasePackage {
    /** Directory relative to the repository root, `.` for a single-package repository. */
    dir: string
    name: string
    manifest: PackageJson
}

function readJson<T>(file: string) {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

const dependencyFields = ['dependencies', 'optionalDependencies', 'peerDependencies'] as const

/** Published packages of the repository in dependency order. */
export function getReleasePackages(cwd: string): ReleasePackage[] {
    let dirs = queryPublicWorkspaceDirs(cwd)
    if (!dirs.length && !readWorkspacePatterns(cwd).length) {
        const root = path.join(cwd, 'package.json')
        if (fs.existsSync(root) && !readJson<PackageJson>(root).private) dirs = ['.']
    }
    const packages = dirs.map((dir) => {
        const manifest = readJson<PackageJson>(path.join(cwd, dir, 'package.json'))
        if (!manifest.name) throw new Error(`${dir}/package.json has no name.`)
        return { dir, name: manifest.name, manifest }
    })
    const names = new Set(packages.map(({ name }) => name))
    const dependenciesOf = (pkg: ReleasePackage) => dependencyFields
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
}

export interface PlanReleaseOptions {
    /** Defaults to `GITHUB_REF_NAME`, then the checked-out branch. */
    branch?: string
    mode?: ReleasePolicy['mode']
    /** Plan as if the branch were `main` when it does not release, for `aronrepo explain` on feature branches. */
    fallbackToMain?: boolean
    /** Tags to ignore, to rebuild the plan of a release that is already tagged. */
    ignoreTags?: string[]
    date?: string
}

/** The repository URL on GitHub, from `GITHUB_REPOSITORY` or the root package.json. */
export function getRepositoryUrl(cwd: string, env: NodeJS.ProcessEnv = process.env) {
    if (env.GITHUB_REPOSITORY) return `${env.GITHUB_SERVER_URL ?? 'https://github.com'}/${env.GITHUB_REPOSITORY}`
    const root = path.join(cwd, 'package.json')
    if (!fs.existsSync(root)) return undefined
    const repository = readJson<PackageJson>(root).repository as string | { url?: string } | undefined
    const url = typeof repository === 'string' ? repository : repository?.url
    const match = url && /github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?\/?$/.exec(url)
    return match ? `https://github.com/${match[1]}` : undefined
}

async function getBranch(environment: ReleaseEnvironment, branch?: string) {
    return branch ?? environment.env.GITHUB_REF_NAME ?? await git(environment, ['rev-parse', '--abbrev-ref', 'HEAD'])
}

/** Plans the next release of the checked-out commit without changing anything. */
export async function planRelease(options: PlanReleaseOptions = {}, environmentOptions: Partial<ReleaseEnvironment> = {}): Promise<ReleasePlan> {
    const environment = createEnvironment(environmentOptions)
    const { cwd } = environment
    const project = await loadProjectPolicy(cwd, options.mode ? { mode: options.mode } : {})
    const branch = await getBranch(environment, options.branch)
    const channel = getReleaseChannel(branch) ?? (options.fallbackToMain ? getReleaseChannel('main') : undefined)
    const head = await git(environment, ['rev-parse', 'HEAD'])
    const ignored = new Set(options.ignoreTags ?? [])
    const reachable = lines(await git(environment, ['tag', '--list', 'v*', '--merged', 'HEAD'])).filter((tag) => !ignored.has(tag))
    const all = lines(await git(environment, ['tag', '--list', 'v*'])).filter((tag) => !ignored.has(tag))
    const packages = getReleasePackages(cwd)
    const base: ReleasePlan = { branch, head, mode: project.policy.mode, release: false, commits: [], packages }
    if (!channel) return base

    const from = getBaseTag(channel, reachable)
    const decision = resolveRelease(
        getRangeCommits(cwd, from, 'HEAD'),
        project.policy,
        project.isReleasePath ? { isReleasePath: project.isReleasePath } : {}
    )
    const plan: ReleasePlan = { ...base, channel, ...(from ? { from } : {}), release: decision.release, commits: decision.commits }
    if (!decision.release) return plan

    const version = getNextVersion(channel, decision.release, { reachable, all })
    const repositoryUrl = getRepositoryUrl(cwd, environment.env)
    return {
        ...plan,
        version,
        tag: toVersionTag(version),
        notes: renderReleaseNotes({
            version,
            ...(from ? { previousTag: from } : {}),
            date: options.date ?? new Date().toISOString().slice(0, 10),
            ...(repositoryUrl ? { repositoryUrl } : {}),
            commits: decision.commits
        })
    }
}

/** Registry of a package: its scoped registry, `publishConfig.registry`, `NPM_CONFIG_REGISTRY`, then npm. */
export function getRegistry(manifest: PackageJson, env: NodeJS.ProcessEnv = process.env) {
    const scope = manifest.name?.startsWith('@') ? manifest.name.split('/')[0] : undefined
    const configured = (scope ? manifest.publishConfig?.[`${scope}:registry`] : undefined)
        ?? manifest.publishConfig?.registry
        ?? env.NPM_CONFIG_REGISTRY
    const registry = typeof configured === 'string' && configured ? configured : officialRegistry
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

async function readPackument(environment: ReleaseEnvironment, registry: string, name: string): Promise<Packument | undefined> {
    const response = await environment.fetch(`${registry}${name.replace('/', '%2f')}`, {
        headers: { accept: 'application/json', 'cache-control': 'no-cache' }
    })
    if (response.status === 404) return undefined
    if (!response.ok) throw new Error(`Could not read ${name} from ${registry}: ${response.status} ${response.statusText}`)
    return await response.json() as Packument
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
    const identity = environment.env.NPM_ID_TOKEN ?? await getGitHubIdToken(environment, 'npm:registry.npmjs.org')
    if (!identity) return undefined
    const response = await environment.fetch(`${officialRegistry}-/npm/v1/oidc/token/exchange/package/${encodeURIComponent(name)}`, {
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

function hasRegistryAuth(content: string, registry: string) {
    const nerfed = nerfDart(registry)
    return content.split(/\r?\n/).some((line) => {
        const key = line.split('=')[0].trim()
        return key === '_authToken' || key === '_auth' || key.startsWith(`${nerfed}:_auth`)
    })
}

/**
 * npm environment for one package: existing `.npmrc` auth, then npm trusted
 * publishing through GitHub Actions OIDC, then `NPM_TOKEN`.
 */
async function createNpmEnv(environment: ReleaseEnvironment, name: string, registry: string, directory: string) {
    const userconfig = environment.env.NPM_CONFIG_USERCONFIG ?? path.join(os.homedir(), '.npmrc')
    const existing = [readNpmrc(path.join(environment.cwd, '.npmrc')), readNpmrc(userconfig)].join('\n')
    if (hasRegistryAuth(existing, registry)) return environment.env

    const token = await exchangeOidcToken(environment, name, registry) ?? environment.env.NPM_TOKEN
    if (!token) {
        throw new Error(`No npm auth for ${name}. Configure npm trusted publishing with \`id-token: write\`, set NPM_TOKEN, or add auth to .npmrc for ${registry}.`)
    }
    const file = path.join(directory, `${name.replace(/[@/]/g, '_')}.npmrc`)
    fs.writeFileSync(file, `${readNpmrc(userconfig).trim()}\n${nerfDart(registry)}:_authToken=${token}\n`, { mode: 0o600 })
    return { ...environment.env, NPM_CONFIG_USERCONFIG: file }
}

function detectIndent(content: string) {
    return /^(\s+)"/m.exec(content)?.[1] ?? '    '
}

/** Writes the release version and git head into a package manifest. */
export function writeReleaseManifest(cwd: string, dir: string, version: string, gitHead: string) {
    const file = path.join(cwd, dir, 'package.json')
    const content = fs.readFileSync(file, 'utf8')
    const manifest = JSON.parse(content) as PackageJson
    manifest.version = version
    manifest.gitHead = gitHead
    fs.writeFileSync(file, `${JSON.stringify(manifest, null, detectIndent(content))}\n`)
    return manifest
}

function packCommand(packageManager: PackageManager, destination: string): [string, string[]] {
    switch (packageManager) {
        case 'bun':
            return ['bun', ['pm', 'pack', '--destination', destination, '--quiet']]
        case 'pnpm':
            return ['pnpm', ['pack', '--pack-destination', destination]]
        case 'yarn':
            return ['yarn', ['pack', '--out', path.join(destination, 'package.tgz')]]
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
            return JSON.parse(body.toString('utf8')) as PackageJson
        }
        offset += 512 + Math.ceil(size / 512) * 512
    }
    throw new Error(`${tarball} has no package.json.`)
}

function validatePackedManifest(manifest: PackageJson, pkg: ReleasePackage, version: string, gitHead: string) {
    if (manifest.name !== pkg.name) throw new Error(`The tarball of ${pkg.dir} is ${manifest.name}, not ${pkg.name}.`)
    if (manifest.version !== version) throw new Error(`The tarball of ${pkg.name} has version ${manifest.version}, not ${version}.`)
    if (manifest.gitHead !== gitHead) throw new Error(`The tarball of ${pkg.name} has gitHead ${String(manifest.gitHead)}, not ${gitHead}.`)
    for (const field of dependencyFields) {
        for (const [name, range] of Object.entries((manifest[field] ?? {}) as Record<string, string>)) {
            if (range.startsWith('workspace:')) throw new Error(`The tarball of ${pkg.name} keeps \`${name}: ${range}\` in ${field}.`)
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

export interface GitHubRelease {
    tag: string
    notes: string
    prerelease: boolean
}

function truncateNotes(notes: string, url: string | undefined) {
    if (notes.length <= releaseBodyLimit) return notes
    const cut = notes.slice(0, releaseBodyLimit)
    return `${cut.slice(0, cut.lastIndexOf('\n'))}\n\n…the notes are too long for a GitHub release${url ? `; see ${url}` : ''}.\n`
}

/** Creates the GitHub release of a tag unless it exists. Needs `GITHUB_TOKEN` and the repository. */
export async function publishGitHubRelease(environment: ReleaseEnvironment, release: GitHubRelease) {
    const token = environment.env.GITHUB_TOKEN ?? environment.env.GH_TOKEN
    const repositoryUrl = getRepositoryUrl(environment.cwd, environment.env)
    const repository = repositoryUrl?.replace(/^https:\/\/[^/]+\//, '')
    if (!token || !repository) {
        environment.log('! Skip the GitHub release: set GITHUB_TOKEN and a GitHub repository URL.')
        return undefined
    }
    const api = `${environment.env.GITHUB_API_URL ?? 'https://api.github.com'}/repos/${repository}/releases`
    const headers = {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'x-github-api-version': '2022-11-28'
    }
    const existing = await environment.fetch(`${api}/tags/${encodeURIComponent(release.tag)}`, { headers })
    if (existing.ok) {
        environment.log(`✓ GitHub release ${release.tag} exists.`)
        return (await existing.json() as { html_url?: string }).html_url
    }
    const response = await environment.fetch(api, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            tag_name: release.tag,
            name: release.tag,
            body: truncateNotes(release.notes, repositoryUrl ? `${repositoryUrl}/compare` : undefined),
            prerelease: release.prerelease,
            make_latest: release.prerelease ? 'false' : 'true'
        })
    })
    if (!response.ok) throw new Error(`Could not create the GitHub release ${release.tag}: ${response.status} ${await response.text()}`)
    const url = (await response.json() as { html_url?: string }).html_url
    environment.log(`✓ Created the GitHub release ${url ?? release.tag}.`)
    return url
}

export interface ReleaseOptions extends PlanReleaseOptions {
    /** Plans and prints the release without changing anything. */
    dryRun?: boolean
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

/** Creates a missing GitHub release when HEAD carries a version tag from an earlier, interrupted run. */
async function resumeTaggedRelease(environment: ReleaseEnvironment, options: ReleaseOptions, plan: ReleasePlan) {
    const tags = lines(await git(environment, ['tag', '--list', 'v*', '--points-at', 'HEAD']))
    const tag = plan.channel && tags.find((candidate) => {
        const prerelease = candidate.includes('-')
        return plan.channel!.prerelease ? candidate.includes(`-${plan.channel!.prerelease}.`) : !prerelease
    })
    if (!tag || options.dryRun) return false
    const previous = await planRelease({ ...options, ignoreTags: [tag] }, environment)
    if (!previous.notes || previous.tag !== tag) return false
    environment.log(`${tag} points at HEAD; make sure its GitHub release exists.`)
    await publishGitHubRelease(environment, { tag, notes: previous.notes, prerelease: Boolean(plan.channel!.prerelease) })
    return true
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
        log('No release.')
        return { status: 'none', plan }
    }
    if (!plan.packages.length) throw new Error('No published package found. Add `"publishConfig": { "access": "public" }` to the packages that ship.')
    if (options.dryRun) {
        log(`\nDry run: would publish ${plan.tag} on ${plan.channel.distTag}.\n\n${plan.notes}`)
        return { status: 'dry-run', plan }
    }

    if (await git(environment, ['status', '--porcelain'])) throw new Error('The working tree has changes. Release from a clean checkout.')
    const existingTag = await git(environment, ['tag', '--list', plan.tag])
    if (existingTag) throw new Error(`${plan.tag} exists but is not reachable from ${plan.branch}.`)

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-release-'))
    const manifests = new Map(plan.packages.map(({ dir }) => {
        const file = path.join(cwd, dir, 'package.json')
        return [file, fs.readFileSync(file, 'utf8')]
    }))
    try {
        const packageManager = detectPackageManager(cwd)
        // Every version must be written before packing, so workspace ranges resolve to it.
        for (const pkg of plan.packages) pkg.manifest = writeReleaseManifest(cwd, pkg.dir, plan.version, plan.head)

        const tarballs = new Map<string, string>()
        for (const [index, pkg] of plan.packages.entries()) {
            const destination = path.join(directory, String(index))
            fs.mkdirSync(destination)
            const [command, args] = packCommand(packageManager, destination)
            await environment.run(command, args, { cwd: path.join(cwd, pkg.dir), env: environment.env })
            const tarball = fs.readdirSync(destination).find((file) => file.endsWith('.tgz'))
            if (!tarball) throw new Error(`Packing ${pkg.name} produced no tarball.`)
            const file = path.join(destination, tarball)
            validatePackedManifest(readPackedManifest(file), pkg, plan.version, plan.head)
            tarballs.set(pkg.name, file)
            log(`✓ Packed ${pkg.name}@${plan.version}`)
        }

        const npmEnvs = new Map<string, NodeJS.ProcessEnv>()
        const npmEnv = async (pkg: ReleasePackage) => {
            if (!npmEnvs.has(pkg.name)) npmEnvs.set(pkg.name, await createNpmEnv(environment, pkg.name, getRegistry(pkg.manifest, environment.env), directory))
            return npmEnvs.get(pkg.name)!
        }

        for (const pkg of plan.packages) {
            const registry = getRegistry(pkg.manifest, environment.env)
            const published = (await readPackument(environment, registry, pkg.name))?.versions?.[plan.version]
            if (published) {
                if (published.gitHead !== plan.head) {
                    throw new Error(`${pkg.name}@${plan.version} is already published from ${published.gitHead ?? 'another commit'}, not ${plan.head}.`)
                }
                log(`✓ ${pkg.name}@${plan.version} is already published from this commit.`)
                continue
            }
            const args = ['publish', tarballs.get(pkg.name)!, '--tag', stagingDistTag, '--registry', registry]
            if (pkg.manifest.publishConfig?.access) args.push('--access', String(pkg.manifest.publishConfig.access))
            if (pkg.manifest.publishConfig?.provenance) args.push('--provenance')
            await environment.run('npm', args, { cwd, env: await npmEnv(pkg) })
            log(`✓ Published ${pkg.name}@${plan.version} on ${stagingDistTag}`)
        }

        for (const pkg of plan.packages) {
            const registry = getRegistry(pkg.manifest, environment.env)
            const published = await waitForVersion(environment, registry, pkg.name, plan.version)
            if (pkg.manifest.publishConfig?.provenance && !published.dist?.attestations) {
                log(`! ${pkg.name}@${plan.version} has no provenance attestation on ${registry}.`)
            }
        }

        for (const pkg of plan.packages) {
            const registry = getRegistry(pkg.manifest, environment.env)
            const tags = (await readPackument(environment, registry, pkg.name))?.['dist-tags'] ?? {}
            const env = await npmEnv(pkg)
            if (tags[plan.channel.distTag] !== plan.version) {
                await environment.run('npm', ['dist-tag', 'add', `${pkg.name}@${plan.version}`, plan.channel.distTag, '--registry', registry], { cwd, env })
            }
            if (tags[stagingDistTag]) {
                await environment.run('npm', ['dist-tag', 'rm', pkg.name, stagingDistTag, '--registry', registry], { cwd, env })
                    .catch((error: Error) => log(`! Could not remove the ${stagingDistTag} dist-tag of ${pkg.name}: ${error.message}`))
            }
            log(`✓ ${pkg.name}@${plan.version} is on ${plan.channel.distTag}`)
        }
    } finally {
        fs.rmSync(directory, { recursive: true, force: true })
        // Versions live in tags and on the registry, not in the repository.
        for (const [file, content] of manifests) fs.writeFileSync(file, content)
    }

    await git(environment, ['tag', plan.tag, plan.head])
    await git(environment, ['push', 'origin', `refs/tags/${plan.tag}`])
    log(`✓ Pushed ${plan.tag}`)

    await publishGitHubRelease(environment, { tag: plan.tag, notes: plan.notes, prerelease: Boolean(plan.channel.prerelease) })
    return { status: 'released', plan }
}
