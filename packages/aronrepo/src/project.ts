import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { globSync } from 'tinyglobby'
import { load as loadYaml } from 'js-yaml'
import {
    createReleasePathMatcher,
    defaultReleasePathExcludes,
    getReleasePolicy,
    resolveRelease,
    type AronrepoConfig,
    type CommitInput,
    type ReleasePathsConfig,
    type ReleasePolicy
} from './policy'

export interface PackageJson {
    name?: string
    version?: string
    private?: boolean
    workspaces?: string[] | { packages?: string[] }
    publishConfig?: {
        access?: string
        provenance?: boolean
        [key: string]: unknown
    }
    [key: string]: unknown
}

/** Config files in lookup order. Node 22.18+ imports `.ts` files by stripping their types. */
export const configFileNames = ['aronrepo.config.js', 'aronrepo.config.mjs', 'aronrepo.config.cjs', 'aronrepo.config.ts', 'aronrepo.config.mts', 'aronrepo.config.cts']

function toPosixPath(value: string) {
    return value.split(path.sep).join('/')
}

/** Reads JSON like npm does, accepting a UTF-8 byte order mark, and names the file when it is invalid. */
export function readJsonFile<T>(file: string) {
    const content = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
    try {
        return JSON.parse(content) as T
    } catch (error) {
        throw new Error(`${file} is not valid JSON: ${(error as Error).message}`, { cause: error })
    }
}

const readJson = readJsonFile

export function findConfigFile(cwd = process.cwd()) {
    return configFileNames
        .map((name) => path.join(cwd, name))
        .find((file) => fs.existsSync(file))
}

/** Loads `aronrepo.config.js` from the repository root; returns `{}` when it is missing. */
export async function loadConfig(cwd = process.cwd()): Promise<AronrepoConfig> {
    const file = findConfigFile(cwd)
    if (!file) return {}
    // The query keeps long-lived processes from reusing a cached module after the file changes.
    const stat = fs.statSync(file)
    const url = `${pathToFileURL(file).href}?mtime=${stat.mtimeMs}&size=${stat.size}`
    const module = await import(url) as { default?: AronrepoConfig }
    return module.default ?? {}
}

function readPNPMWorkspaces(cwd: string) {
    const workspacePath = path.join(cwd, 'pnpm-workspace.yaml')
    if (!fs.existsSync(workspacePath)) return undefined

    const content = fs.readFileSync(workspacePath, 'utf8')
    // js-yaml 5 rejects an empty document, such as a file with only comments.
    if (!content.split('\n').some((line) => line.trim() && !line.trim().startsWith('#'))) return undefined
    const workspace = loadYaml(content) as { packages?: string[] } | null | undefined
    return workspace?.packages
}

function readNPMWorkspaces(cwd: string) {
    const packagePath = path.join(cwd, 'package.json')
    if (!fs.existsSync(packagePath)) return undefined

    const pkg = readJson<PackageJson>(packagePath)
    return Array.isArray(pkg.workspaces)
        ? pkg.workspaces
        : pkg.workspaces?.packages
}

export function readWorkspacePatterns(cwd = process.cwd()) {
    return readPNPMWorkspaces(cwd) ?? readNPMWorkspaces(cwd) ?? []
}

export function queryWorkspaceDirs(patterns: string[], cwd = process.cwd()) {
    if (!patterns.length) return []

    return globSync(
        patterns.map((workspace) => `${workspace}/package.json`),
        {
            cwd,
            onlyFiles: true,
            expandDirectories: false,
            ignore: [
                '**/node_modules/**'
            ]
        }
    )
        .map((workspacePackage) => toPosixPath(workspacePackage).replace(/\/?package\.json$/, '') || '.')
        .sort()
}

export function readWorkspacePackage(cwd: string, workspace: string) {
    return readJson<PackageJson>(path.join(cwd, workspace, 'package.json'))
}

/**
 * Directories of the packages that ship: public, non-private workspace packages,
 * and the root package when it is published too. A root package without
 * workspaces ships unless it is private; with workspaces it needs
 * `publishConfig.access: "public"` like the others.
 */
export function queryReleaseDirs(cwd = process.cwd()) {
    const dirs = queryPublicWorkspaceDirs(cwd)
    const rootFile = path.join(cwd, 'package.json')
    if (dirs.includes('.') || !fs.existsSync(rootFile)) return dirs
    const root = readJson<PackageJson>(rootFile)
    const hasWorkspaces = readWorkspacePatterns(cwd).length > 0
    if (root.name && !root.private && (!hasWorkspaces || root.publishConfig?.access === 'public')) return ['.', ...dirs]
    return dirs
}

/** Workspace directories whose package is published to npm: public and not private. */
export function queryPublicWorkspaceDirs(cwd = process.cwd()) {
    return queryWorkspaceDirs(readWorkspacePatterns(cwd), cwd)
        .filter((workspace) => {
            const pkg = readWorkspacePackage(cwd, workspace)
            return pkg.publishConfig?.access === 'public' && !pkg.private
        })
}

/**
 * Resolves the files whose changes can release a version.
 *
 * Configured paths win. Otherwise public workspace packages define them; a
 * single-package repository with a non-private root package uses every path.
 * Returns `undefined` when no published package is found, which turns the check off.
 */
export function resolveReleasePaths(cwd = process.cwd(), policy?: Pick<ReleasePolicy, 'paths'>): ReleasePathsConfig | undefined {
    if (policy?.paths === false) return undefined
    if (policy?.paths?.include) {
        return { include: policy.paths.include, exclude: policy.paths.exclude ?? defaultReleasePathExcludes }
    }
    const exclude = policy?.paths?.exclude ?? defaultReleasePathExcludes
    const dirs = queryReleaseDirs(cwd)
    if (!dirs.length) return undefined
    return { include: dirs.includes('.') ? ['**'] : dirs.map((dir) => `${dir}/**`), exclude }
}

export type PackageManager = 'bun' | 'pnpm' | 'yarn' | 'npm'

const lockfiles: Array<[string, PackageManager]> = [
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
    ['pnpm-lock.yaml', 'pnpm'],
    ['pnpm-workspace.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm']
]

/** The package manager from `packageManager` in package.json, then from the lockfile; `npm` by default. */
export function detectPackageManager(cwd = process.cwd()): PackageManager {
    const rootPackage = path.join(cwd, 'package.json')
    const declared = fs.existsSync(rootPackage) ? String(readJson<PackageJson>(rootPackage).packageManager ?? '').split('@')[0] : ''
    if (declared === 'bun' || declared === 'pnpm' || declared === 'yarn' || declared === 'npm') return declared
    return lockfiles.find(([file]) => fs.existsSync(path.join(cwd, file)))?.[1] ?? 'npm'
}

/** How to run the aronrepo CLI with a package manager. */
export function getCliCommand(packageManager: PackageManager) {
    return {
        bun: 'bun x aronrepo',
        pnpm: 'pnpm exec aronrepo',
        yarn: 'yarn aronrepo',
        npm: 'npx aronrepo'
    }[packageManager]
}

/**
 * How to run the aronrepo CLI in a repository: its `aronrepo` script when it has
 * one, for example a workspace that builds aronrepo itself, or the installed binary.
 */
export function getProjectCliCommand(cwd: string, packageManager = detectPackageManager(cwd)) {
    const rootPackage = path.join(cwd, 'package.json')
    const scripts = fs.existsSync(rootPackage) ? readJson<PackageJson>(rootPackage).scripts as Record<string, string> | undefined : undefined
    if (scripts?.aronrepo) return packageManager === 'npm' ? 'npm run aronrepo --' : `${packageManager} run aronrepo`
    return getCliCommand(packageManager)
}

export interface ProjectPolicy {
    cwd: string
    packageManager: PackageManager
    /** How to run the aronrepo CLI in this repository. */
    cli: string
    config: AronrepoConfig
    configFile?: string
    policy: ReleasePolicy
    releasePaths?: ReleasePathsConfig
    isReleasePath?: (file: string) => boolean
}

/** Loads the config, release policy, and release paths of a repository. */
export async function loadProjectPolicy(cwd = process.cwd(), overrides: Partial<ReleasePolicy> = {}): Promise<ProjectPolicy> {
    const config = await loadConfig(cwd)
    const policy = { ...getReleasePolicy(config), ...overrides }
    const releasePaths = resolveReleasePaths(cwd, policy)
    const configFile = findConfigFile(cwd)
    const packageManager = detectPackageManager(cwd)
    return {
        cwd,
        packageManager,
        cli: getProjectCliCommand(cwd, packageManager),
        config,
        ...(configFile ? { configFile } : {}),
        policy,
        ...(releasePaths ? { releasePaths } : {}),
        ...(releasePaths ? { isReleasePath: createReleasePathMatcher(releasePaths) } : {})
    }
}

function git(cwd: string, args: string[]) {
    if (!fs.existsSync(cwd)) throw new Error(`${cwd} does not exist.`)
    try {
        return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) {
        const { stderr, code } = error as { stderr?: string, code?: string }
        if (code === 'ENOENT') throw new Error('git is not installed or not on PATH.', { cause: error })
        throw new Error(`\`git ${args.join(' ')}\` failed: ${stderr?.trim() || (error as Error).message}`, { cause: error })
    }
}

/** The repository root that contains `cwd`, or `cwd` itself outside a git repository. */
export function getRepositoryRoot(cwd = process.cwd()) {
    try {
        return git(cwd, ['rev-parse', '--show-toplevel']).trim() || cwd
    } catch {
        return cwd
    }
}

/** A git config value, or `undefined` when it is not set. */
export function getGitConfig(cwd: string, key: string) {
    try {
        return git(cwd, ['config', '--get', key]).trim() || undefined
    } catch {
        return undefined
    }
}

/**
 * NUL-separated paths. `-z` keeps git from quoting paths with non-ASCII or
 * special characters, such as `"docs/\\346\\226\\207.md"`, which would never
 * match a release path.
 */
function splitPaths(output: string) {
    return output.split('\0').map((file) => file.replace(/^\n/, '')).filter(Boolean)
}

// Rename detection lists only the new path; both paths decide whether a commit ships.
const nameOnly = ['--name-only', '-z', '--no-renames']

/** Files changed by one commit. Merge commits report no files. */
export function getCommitFiles(cwd: string, hash: string) {
    return splitPaths(git(cwd, ['diff-tree', '--no-commit-id', ...nameOnly, '-r', '--root', hash]))
}

export function getStagedFiles(cwd = process.cwd()) {
    return splitPaths(git(cwd, ['diff', '--cached', ...nameOnly]))
}

/** Files changed between the merge base of `base` and `head`, like a pull request diff. */
export function getDiffFiles(cwd: string, base: string, head: string) {
    return splitPaths(git(cwd, ['diff', ...nameOnly, `${base}...${head}`]))
}

/** Commits in `from..to`, oldest first, with their changed files, from one `git log`. Merge commits report no files. */
export function getRangeCommits(cwd: string, from: string | undefined, to = 'HEAD'): Required<CommitInput>[] {
    const range = from ? `${from}..${to}` : to
    const output = git(cwd, [
        '-c', 'log.showSignature=false',
        'log', '--reverse', '--no-color', ...nameOnly, '--format=%x1e%H%x1f%B%x1f', range, '--'
    ])
    return output.split('\x1e')
        .filter((entry) => entry.includes('\x1f'))
        .map((entry) => {
            const hashEnd = entry.indexOf('\x1f')
            const messageEnd = entry.indexOf('\x1f', hashEnd + 1)
            return {
                hash: entry.slice(0, hashEnd),
                message: entry.slice(hashEnd + 1, messageEnd).trim(),
                files: splitPaths(entry.slice(messageEnd + 1))
            }
        })
}

/**
 * Latest `v*` version tag reachable from `ref`, or `undefined` when there is none.
 * A tag on `ref` itself does not count, so `explain --to v1.1.0` explains v1.1.0.
 */
export function getLatestTag(cwd: string, ref = 'HEAD') {
    try {
        return git(cwd, ['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', `${ref}^`]).trim() || undefined
    } catch {
        return undefined
    }
}

/** `v*` tags, optionally only those merged into `ref`; none when `ref` does not exist, such as the parent of a root commit. */
export function getVersionTags(cwd: string, mergedInto?: string) {
    try {
        return splitPaths(git(cwd, ['tag', '--list', 'v*', ...(mergedInto ? ['--merged', mergedInto] : [])]).replace(/\n/g, '\0'))
    } catch {
        return []
    }
}

/**
 * `v*` tags reachable from `ref` except those on `ref` itself, so a tag on `ref` is
 * explained instead of skipped. Unlike tags of `ref^`, this keeps tags on every parent
 * of a merge commit, as `aronrepo release` does.
 */
export function getPriorVersionTags(cwd: string, ref: string) {
    const own = new Set(splitPaths(git(cwd, ['tag', '--list', 'v*', '--points-at', ref]).replace(/\n/g, '\0')))
    return getVersionTags(cwd, ref).filter((tag) => !own.has(tag))
}

/** The full hash of the commit a ref points at. */
export function getCommitHash(cwd: string, ref = 'HEAD') {
    return git(cwd, ['rev-parse', '--verify', `${ref}^{commit}`]).trim()
}

/** The checked-out branch, or `undefined` on a detached HEAD. */
export function getCurrentBranch(cwd: string) {
    const branch = git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()
    return branch === 'HEAD' ? undefined : branch
}

/** Resolves the release of a commit range with the repository's policy and release paths. */
export async function explainRange(cwd: string, from: string | undefined, to = 'HEAD', overrides: Partial<ReleasePolicy> = {}) {
    const project = await loadProjectPolicy(cwd, overrides)
    const commits = getRangeCommits(cwd, from, to)
    return {
        ...project,
        from,
        to,
        ...resolveRelease(commits, project.policy, project.isReleasePath ? { isReleasePath: project.isReleasePath } : {})
    }
}
