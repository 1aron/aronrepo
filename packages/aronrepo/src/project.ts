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

export const configFileNames = ['aronrepo.config.js', 'aronrepo.config.mjs']

function toPosixPath(value: string) {
    return value.split(path.sep).join('/')
}

function readJson<T>(file: string) {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

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

    const workspace = loadYaml(fs.readFileSync(workspacePath, 'utf8')) as { packages?: string[] } | undefined
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
    const publicWorkspaces = queryPublicWorkspaceDirs(cwd)
    if (publicWorkspaces.length) {
        return { include: publicWorkspaces.map((dir) => dir === '.' ? '**' : `${dir}/**`), exclude }
    }
    const rootPackage = path.join(cwd, 'package.json')
    if (!readWorkspacePatterns(cwd).length && fs.existsSync(rootPackage) && !readJson<PackageJson>(rootPackage).private) {
        return { include: ['**'], exclude }
    }
    return undefined
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
    return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
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

/** Latest `v*` version tag reachable from `ref`, or `undefined` when there is none. */
export function getLatestTag(cwd: string, ref = 'HEAD') {
    try {
        return git(cwd, ['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', ref]).trim() || undefined
    } catch {
        return undefined
    }
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
