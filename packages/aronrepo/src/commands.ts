import fs from 'node:fs'
import path from 'node:path'
import {
    agentsBlockEnd,
    agentsBlockStart,
    commits,
    getBaseTag,
    getNextVersion,
    getReleaseChannel,
    getReleaseType,
    legacyCommits,
    defaultReleasePathExcludes,
    getAgentCommitPolicy,
    getReleaseTable,
    renderAgentsBlock,
    renderReleaseNotes,
    resolveRelease,
    toVersionTag,
    type CommitDecision,
    type CommitViolation,
    type ReleaseMode
} from './index'
import {
    detectPackageManager,
    getCliCommand,
    getCommitAuthorDate,
    getCommitFiles,
    getCommitHash,
    getCurrentBranch,
    getDiffFiles,
    getGitConfig,
    getPriorVersionTags,
    getRangeCommits,
    getRepositoryRoot,
    getStagedFiles,
    getVersionTags,
    loadProjectPolicy,
    readJsonFile,
    type PackageManager,
    type ProjectPolicy
} from './project'
import { getReleasePackages, getRepositoryUrl, planRelease, runRelease, type ReleasePlan } from './release'

export interface CommandResult {
    code: number
    output: string
}

export interface CommonOptions {
    /** Repository root. Defaults to the root of the git repository around the current directory. */
    cwd?: string
    mode?: ReleaseMode
    json?: boolean
}

function resolveCwd(options: CommonOptions) {
    return options.cwd ? path.resolve(options.cwd) : getRepositoryRoot(process.cwd())
}

function usage(message: string): CommandResult {
    return { code: 2, output: message }
}

// Messages that git, GitHub, GitLab, or Bitbucket write for you, in their exact formats.
const ignoredMessagePatterns = [
    /^Merge pull request #\d+ from \S+/,
    /^Merge (?:branch|branches|remote-tracking branch|tag|commit) '[^']+'/,
    /^Merge [0-9a-f]{7,40}(?: into \S+)?$/,
    /^Merged in \S+ \(pull request #\d+\)/,
    /^Automatic merge from /,
    /^Auto-merged \S+ into \S+/,
    /^(?:fixup|squash|amend)! /,
    /^Initial commit$/
]

export function isIgnoredMessage(message: string) {
    const header = message.trim().split('\n')[0] ?? ''
    return ignoredMessagePatterns.some((pattern) => pattern.test(header))
}

function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** The characters `core.commentChar=auto` picks from, in git's order. */
const autoCommentChars = '#;@!$%^&|:'

/**
 * The comment character of a message file written with `core.commentChar=auto`: git picks
 * the first of its candidates that starts no line of the message, so it can be `;` while the
 * header starts with `#`. Its comments follow the message, so the scissors line or the last
 * comment line names it; a file without comments, such as from `git commit -m`, keeps `#`.
 */
function detectCommentChar(content: string) {
    const scissors = new RegExp(`^([${escapeRegExp(autoCommentChars)}]) -+ >8 -+$`, 'm').exec(content)
    if (scissors) return scissors[1]
    const last = content.split('\n').map((line) => line.trimEnd()).filter(Boolean).at(-1) ?? ''
    return autoCommentChars.includes(last[0] ?? '') && (last.length === 1 || /\s/.test(last[1])) ? last[0] : '#'
}

/**
 * A commit message file without git's comments and, with `git commit -v`,
 * without the diff below the scissors line. `commentChar` is git's
 * `core.commentChar`; with `auto`, the character git chose is read from the file.
 */
export function readEditMessage(file: string, commentChar = '#') {
    const content = fs.readFileSync(file, 'utf8')
        .replace(/^\uFEFF/, '')
        .replace(/\r\n/g, '\n')
    const comment = commentChar && commentChar !== 'auto' ? commentChar : detectCommentChar(content)
    return content
        .split(new RegExp(`^${escapeRegExp(comment)} -+ >8 -+$`, 'm'))[0]
        .split('\n')
        .filter((line) => !line.startsWith(comment))
        .join('\n')
        .trim()
}

/**
 * Whether a commit-msg hook runs for a commit that replaces HEAD, such as an amend or a
 * reword, rather than a new commit. git gives the hook the author date of the commit it
 * writes, which an amend keeps from HEAD and a new commit takes from the clock. Without that
 * date, such as outside a hook, it assumes an amend, as earlier versions did.
 */
function rewritesHead(cwd: string, env: NodeJS.ProcessEnv = process.env) {
    if (env.GIT_REFLOG_ACTION?.startsWith('rebase')) return true
    const date = env.GIT_AUTHOR_DATE?.replace(/^@/, '').trim()
    if (!date) return true
    const head = getCommitAuthorDate(cwd, 'HEAD')
    return head === undefined || head === date
}

async function project(cwd: string, options: CommonOptions): Promise<ProjectPolicy> {
    return loadProjectPolicy(cwd, options.mode ? { mode: options.mode } : {})
}

function isError(violation: CommitViolation) {
    return (violation.severity ?? 'error') === 'error'
}

function formatViolation(violation: CommitViolation) {
    return `  ${isError(violation) ? '✗' : '!'} ${violation.message}${violation.suggestion ? `\n    Suggested header: ${violation.suggestion}` : ''}`
}

function formatDecision(decision: CommitDecision) {
    const hash = decision.hash ? `${decision.hash.slice(0, 9)} ` : ''
    return `${hash}${(decision.release || 'none').padEnd(5)}  ${decision.header}\n${decision.reasons.map((reason) => `       ${reason}`).join('\n')}`
}

/** Repository-relative POSIX paths, as git prints them. */
function normalizeFiles(files: string[], cwd: string) {
    return files.map((file) => {
        const relative = path.isAbsolute(file) ? path.relative(cwd, file) : file
        return relative.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '')
    })
}

export interface CheckOptions extends CommonOptions {
    /** Commit message file, as passed to a commit-msg hook, relative to `cwd`. Uses staged files. */
    edit?: string
    /** Commit message text. Uses staged files unless `files` is set. */
    message?: string
    /** PR title, checked against the `base...head` diff. */
    title?: string
    base?: string
    head?: string
    /** Commit range, checked commit by commit with each commit's own files. */
    from?: string
    to?: string
    files?: string[]
}

export async function check(options: CheckOptions): Promise<CommandResult> {
    const modes = [
        options.edit !== undefined && '--edit',
        options.message !== undefined && '--message',
        options.title !== undefined && '--title',
        options.from !== undefined && '--from'
    ].filter(Boolean)
    if (!modes.length) return usage('Pass --edit <file>, --message <text>, --title <text>, or --from <ref>.')
    if (modes.length > 1) return usage(`Pass only one of ${modes.join(', ')}.`)
    if (options.to !== undefined && options.from === undefined) return usage('--to needs --from.')
    if ((options.base !== undefined || options.head !== undefined) && options.title === undefined) return usage('--base and --head only apply to --title.')
    if ((options.base === undefined) !== (options.head === undefined)) return usage('Pass --base and --head together.')
    if (options.files && options.from !== undefined) return usage('--files does not apply to --from; each commit has its own files.')

    const cwd = resolveCwd(options)
    const { policy, isReleasePath } = await project(cwd, options)
    const pathOptions = isReleasePath ? { isReleasePath } : {}
    const files = options.files && normalizeFiles(options.files, cwd)
    const notes: string[] = []
    let entries: Array<{ message: string, hash?: string, files?: string[], label: string, ignorable: boolean }>

    if (options.title !== undefined) {
        const diff = files ?? (options.base && options.head ? getDiffFiles(cwd, options.base, options.head) : undefined)
        if (!diff && isReleasePath) notes.push('! Release paths are not checked; pass --base and --head, or --files.')
        // A squash merge turns the title into a commit header, so git's own messages are no excuse here.
        entries = [{ message: options.title, ...(diff ? { files: diff } : {}), label: 'PR title', ignorable: false }]
    } else if (options.edit !== undefined || options.message !== undefined) {
        let message = options.message ?? ''
        if (options.edit !== undefined) {
            message = readEditMessage(path.resolve(cwd, options.edit), getGitConfig(cwd, 'core.commentChar'))
            // git aborts a commit with an empty message after the hook; let it.
            if (!message) return { code: 0, output: 'The commit message is empty; git aborts the commit.' }
        }
        let changed = files ?? getStagedFiles(cwd)
        // `git commit --amend` with nothing staged and a reword in `git rebase -i` keep the files of HEAD;
        // `git commit --allow-empty` changes none.
        if (!changed.length && !files && options.edit !== undefined && rewritesHead(cwd)) {
            try {
                changed = getCommitFiles(cwd, 'HEAD')
            } catch {
                changed = []
            }
        }
        entries = [{ message, files: changed, label: 'Commit message', ignorable: true }]
    } else {
        entries = getRangeCommits(cwd, options.from, options.to ?? 'HEAD')
            .map((commit) => ({ ...commit, label: commit.hash.slice(0, 9), ignorable: true }))
    }

    const checked = entries.filter(({ message, ignorable }) => !ignorable || !isIgnoredMessage(message))
    // One decision for the whole range, as `explain` and `release` make it, so a revert and the
    // commit it reverts cancel each other here too.
    const decisions = resolveRelease(checked.map(({ message, hash, files }) => ({
        message,
        ...(hash ? { hash } : {}),
        ...(files ? { files } : {})
    })), policy, pathOptions).commits
    const results = checked.map((entry, index) => ({ entry, decision: decisions[index] }))
    const failures = results.filter(({ decision }) => decision.violations.some(isError))

    if (options.json) {
        return {
            code: failures.length ? 1 : 0,
            output: JSON.stringify({
                mode: policy.mode,
                results: results.map(({ entry, decision }) => ({ label: entry.label, ...decision })),
                ...(notes.length ? { notes } : {})
            }, null, 2)
        }
    }
    if (!failures.length) {
        return {
            code: 0,
            output: [
                ...results.map(({ entry, decision }) => [
                    `✓ ${entry.label}: ${decision.release || 'none'} ← ${decision.header}`,
                    ...decision.violations.map(formatViolation)
                ].join('\n')),
                ...notes,
                `${results.length} ${results.length === 1 ? 'header follows' : 'headers follow'} the Aronrepo ${policy.mode} release policy.`
            ].join('\n')
        }
    }
    return {
        code: 1,
        output: [
            ...failures.map(({ entry, decision }) => `${entry.label}: ${decision.header}\n${decision.violations.map(formatViolation).join('\n')}`),
            ...notes,
            '',
            'Run `aronrepo policy` to see which types release and which paths ship.'
        ].join('\n')
    }
}

export interface ExplainOptions extends CommonOptions {
    from?: string
    to?: string
}

export async function explain(options: ExplainOptions): Promise<CommandResult> {
    const cwd = resolveCwd(options)
    const { policy, isReleasePath, releasePaths } = await project(cwd, options)
    let plan: Pick<ReleasePlan, 'release' | 'commits'> & Partial<ReleasePlan>
    let from: string | undefined
    let to = options.to ?? 'HEAD'

    if (options.from === undefined && options.to === undefined) {
        // The release range of the branch, or of main when the branch does not release.
        // The checked-out branch, so explaining never fails because GITHUB_REF_NAME names another branch.
        const branch = getCurrentBranch(cwd)
        plan = await planRelease({
            fallbackToMain: true,
            ...(branch ? { branch } : {}),
            ...(options.mode ? { mode: options.mode } : {})
        }, { cwd })
        from = plan.from
        to = 'HEAD'
    } else {
        // The channel's base tag before `to`, so a tag on `to` itself is explained instead of skipped.
        const channel = getReleaseChannel(getCurrentBranch(cwd)) ?? getReleaseChannel('main')!
        const reachable = getPriorVersionTags(cwd, to)
        from = options.from ?? getBaseTag(channel, reachable)
        const decision = resolveRelease(getRangeCommits(cwd, from, to), policy, isReleasePath ? { isReleasePath } : {})
        const version = decision.release && options.from === undefined
            ? getNextVersion(channel, decision.release, { reachable, all: getVersionTags(cwd) })
            : undefined
        const head = getCommitHash(cwd, to)
        const repositoryUrl = getRepositoryUrl(cwd)
        const notes = version
            ? renderReleaseNotes({
                version,
                ...(from ? { previousTag: from } : {}),
                date: new Date().toISOString().slice(0, 10),
                ...(repositoryUrl ? { repositoryUrl } : {}),
                commits: decision.commits
            })
            : undefined
        plan = { ...decision, channel, head, ...(version ? { version, tag: toVersionTag(version), notes } : {}) }
    }

    if (options.json) {
        return {
            code: 0,
            output: JSON.stringify({
                mode: policy.mode,
                ...(plan.branch ? { branch: plan.branch } : {}),
                ...(plan.channel ? { channel: plan.channel } : {}),
                from: from ?? null,
                to,
                head: plan.head ?? null,
                releasePaths: releasePaths ?? null,
                release: plan.release,
                version: plan.version ?? null,
                tag: plan.tag ?? null,
                commits: plan.commits,
                notes: plan.notes ?? null
            }, null, 2)
        }
    }
    return {
        code: 0,
        output: [
            `Range: ${from ? `${from}..${to}` : `all commits up to ${to}`}`,
            `Mode: ${policy.mode}`,
            ...(plan.channel ? [`Channel: ${plan.channel.branch} (npm dist-tag ${plan.channel.distTag})`] : []),
            `Release paths: ${releasePaths?.include ? releasePaths.include.join(', ') : 'every path'}`,
            '',
            ...(plan.commits.length ? plan.commits.map(formatDecision) : ['No commits.']),
            '',
            `Next release: ${plan.release || 'none'}${plan.version ? ` (${plan.version})` : ''}`
        ].join('\n')
    }
}

export interface ReleaseCommandOptions extends CommonOptions {
    dryRun?: boolean
    branch?: string
    /** The approved version; the release stops when it would release another one. */
    expect?: string
    /** Receives progress lines; defaults to stdout. JSON output stays quiet. */
    log?: (message: string) => void
}

export async function release(options: ReleaseCommandOptions): Promise<CommandResult> {
    const cwd = resolveCwd(options)
    const result = await runRelease({
        ...(options.mode ? { mode: options.mode } : {}),
        ...(options.branch ? { branch: options.branch } : {}),
        ...(options.dryRun ? { dryRun: true } : {}),
        ...(options.expect ? { expectVersion: options.expect } : {})
    }, { cwd, log: options.json ? () => {} : options.log ?? ((message) => console.log(message)) })
    if (!options.json) return { code: 0, output: '' }
    const { packages, ...plan } = result.plan
    return {
        code: 0,
        output: JSON.stringify({ status: result.status, ...plan, packages: packages.map(({ dir, name }) => ({ dir, name })) }, null, 2)
    }
}

export async function policy(options: CommonOptions & { markdown?: boolean }): Promise<CommandResult> {
    if (options.json && options.markdown) return usage('Pass --json or --markdown, not both.')
    const cwd = resolveCwd(options)
    const resolved = await project(cwd, options)
    if (options.markdown) {
        return { code: 0, output: renderAgentsBlock(resolved.policy, { cli: resolved.cli, ...(resolved.releasePaths ? { releasePaths: resolved.releasePaths } : {}) }) }
    }
    const table = getReleaseTable(resolved.policy)
    const data = {
        mode: resolved.policy.mode,
        configFile: resolved.configFile ? path.relative(resolved.cwd, resolved.configFile) : null,
        releasePaths: resolved.releasePaths ?? null,
        // Plain names for machines; the Markdown backticks are for people.
        releaseTable: Object.fromEntries(Object.entries(table).map(([level, rules]) => [level, rules.map((rule) => rule.replace(/`/g, ''))])),
        types: commits.map(({ type, scope, description, group }) => ({
            type,
            ...(scope ? { scope } : {}),
            release: getReleaseType(type, scope, resolved.policy) ?? false,
            description,
            ...(group ? { group } : {})
        })),
        legacyTypes: legacyCommits,
        agent: getAgentCommitPolicy(resolved.policy, { cli: resolved.cli })
    }
    if (options.json) return { code: 0, output: JSON.stringify(data, null, 2) }
    return {
        code: 0,
        output: [
            `Mode: ${data.mode}${data.configFile ? ` (${data.configFile})` : ' (default; no aronrepo.config.js)'}`,
            `Release paths: ${data.releasePaths?.include ? data.releasePaths.include.join(', ') : 'every path'}`,
            ...(data.releasePaths?.include ? [`Excluded: ${(data.releasePaths.exclude ?? defaultReleasePathExcludes).join(', ')}`] : []),
            '',
            `Major: ${table.major.join(', ') || '-'}`,
            `Minor: ${table.minor.join(', ') || '-'}`,
            `Patch: ${table.patch.join(', ') || '-'}`,
            `None:  ${table.none.join(', ') || '-'}`,
            '',
            ...data.agent.ownerDecisions.map((rule) => `- ${rule}`)
        ].join('\n')
    }
}

/** Where the generated block is, `undefined` when there is none; throws when its markers are broken. */
function findAgentsBlock(content: string) {
    const start = content.indexOf(agentsBlockStart)
    const firstEnd = content.indexOf(agentsBlockEnd)
    if (start === -1 && firstEnd === -1) return undefined
    const end = start === -1 ? -1 : content.indexOf(agentsBlockEnd, start)
    if (start === -1 || end === -1 || firstEnd < start) {
        throw new Error(`The Aronrepo commit policy markers are out of order. Keep one ${agentsBlockStart} followed by one ${agentsBlockEnd}.`)
    }
    if (content.indexOf(agentsBlockStart, start + 1) !== -1 || content.indexOf(agentsBlockEnd, end + 1) !== -1) {
        throw new Error('The Aronrepo commit policy block appears more than once. Keep one block.')
    }
    return { start, end: end + agentsBlockEnd.length }
}

export function replaceAgentsBlock(content: string, block: string) {
    const found = findAgentsBlock(content)
    if (found) return content.slice(0, found.start) + block + content.slice(found.end)
    return `${content.trimEnd()}${content.trim() ? '\n\n' : ''}${block}\n`
}

export function readAgentsBlock(content: string) {
    try {
        const found = findAgentsBlock(content)
        return found ? content.slice(found.start, found.end) : undefined
    } catch {
        return undefined
    }
}

export async function agents(options: CommonOptions & { file?: string, write?: boolean }): Promise<CommandResult> {
    const cwd = resolveCwd(options)
    const resolved = await project(cwd, options)
    const file = path.resolve(cwd, options.file ?? 'AGENTS.md')
    const relative = path.relative(cwd, file)
    const block = renderAgentsBlock(resolved.policy, { cli: resolved.cli, ...(resolved.releasePaths ? { releasePaths: resolved.releasePaths } : {}) })
    const raw = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
    // A Windows checkout may have CRLF line endings; compare without them and keep them on write.
    const eol = raw.includes('\r\n') ? '\r\n' : '\n'
    const content = raw.replace(/\r\n/g, '\n')
    const result = (code: number, status: string, message: string): CommandResult => ({
        code,
        output: options.json ? JSON.stringify({ file: relative, status }, null, 2) : message
    })

    if (options.write) {
        const next = replaceAgentsBlock(content || '# Agent Guide\n', block)
        if (next === content) return result(0, 'current', `✓ ${relative} is up to date.`)
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, eol === '\n' ? next : next.replace(/\n/g, eol))
        return result(0, 'written', `✓ Wrote the Aronrepo commit policy block to ${relative}.`)
    }
    const current = readAgentsBlock(content)
    if (current === block) return result(0, 'current', `✓ ${relative} has the current Aronrepo commit policy block.`)
    return result(1, current ? 'outdated' : 'missing', `✗ ${relative} ${current ? 'has an outdated' : 'is missing the'} Aronrepo commit policy block. Run \`${resolved.cli} agents --write\`.`)
}

interface DoctorCheck {
    status: 'pass' | 'warn' | 'fail'
    message: string
    fix?: string
}

function findFile(cwd: string, names: string[]) {
    return names.map((name) => path.join(cwd, name)).find((file) => fs.existsSync(file))
}

function readText(file: string | undefined) {
    return file ? fs.readFileSync(file, 'utf8') : ''
}

const legacyDependencies = [
    'semantic-release',
    '@commitlint/cli',
    '@aronrepo/commitlint-config',
    '@aronrepo/conventional-changelog-config',
    '@aronrepo/semantic-release-config',
    '@aronrepo/semantic-release-pnpm'
]

const legacyConfigFiles = [
    'release.config.js', 'release.config.mjs', 'release.config.cjs', '.releaserc', '.releaserc.js', '.releaserc.mjs', '.releaserc.json',
    'commitlint.config.js', 'commitlint.config.mjs', 'commitlint.config.ts', '.commitlintrc', '.commitlintrc.js', '.commitlintrc.mjs', '.commitlintrc.json'
]

function installCommand(packageManager: PackageManager) {
    return {
        bun: 'bun add -d aronrepo',
        pnpm: 'pnpm add -D aronrepo',
        yarn: 'yarn add -D aronrepo',
        npm: 'npm install -D aronrepo'
    }[packageManager]
}

export async function doctor(options: CommonOptions): Promise<CommandResult> {
    const cwd = resolveCwd(options)
    const checks: DoctorCheck[] = []
    let resolved: ProjectPolicy | undefined
    // An invalid package.json is reported below; fall back to npm for the hints.
    const packageManager = (() => {
        try {
            return detectPackageManager(cwd)
        } catch {
            return 'npm'
        }
    })()
    const cli = getCliCommand(packageManager)

    try {
        resolved = await project(cwd, options)
        checks.push(resolved.configFile
            ? { status: 'pass', message: `Release mode ${resolved.policy.mode} from ${path.relative(cwd, resolved.configFile)}.` }
            : {
                status: 'warn',
                message: `No aronrepo.config.js; using the default ${resolved.policy.mode} mode.`,
                fix: 'Ask the repository owner whether releases are explicit (owner-controlled) or auto, then create aronrepo.config.js with `release.mode`.'
            })
    } catch (error) {
        checks.push({ status: 'fail', message: `The Aronrepo config failed to load: ${(error as Error).message}` })
    }

    if (resolved) {
        checks.push(resolved.releasePaths?.include
            ? { status: 'pass', message: `Release paths: ${resolved.releasePaths.include.join(', ')}.` }
            : {
                status: 'warn',
                message: 'No published package found; every path can release a version.',
                fix: 'Set `release.paths.include` in aronrepo.config.js, or add `publishConfig.access: "public"` to published packages.'
            })
    }

    let pkg: Record<string, unknown> = {}
    try {
        const file = findFile(cwd, ['package.json'])
        if (file) pkg = readJsonFile<Record<string, unknown>>(file)
    } catch (error) {
        checks.push({ status: 'fail', message: (error as Error).message })
    }
    const dependencies = { ...pkg.dependencies as Record<string, string>, ...pkg.devDependencies as Record<string, string> }
    checks.push(dependencies.aronrepo
        ? { status: 'pass', message: 'aronrepo is installed.' }
        : { status: 'fail', message: 'aronrepo is not a dependency.', fix: `Install it as a dev dependency: \`${installCommand(packageManager)}\`.` })

    const leftovers = [
        ...legacyDependencies.filter((name) => dependencies[name]),
        ...legacyConfigFiles.filter((name) => fs.existsSync(path.join(cwd, name)))
    ]
    checks.push(leftovers.length
        ? {
            status: 'warn',
            message: `Leftovers from semantic-release or commitlint: ${leftovers.join(', ')}.`,
            fix: 'Remove them; `aronrepo check` lints commits and `aronrepo release` publishes releases.'
        }
        : { status: 'pass', message: 'No semantic-release or commitlint leftovers.' })

    try {
        const releasePackages = getReleasePackages(cwd)
        // `aronrepo release` writes the root repository into workspace packages, so either one is enough.
        const withoutRepository = releasePackages.filter(({ manifest }) => manifest.publishConfig?.provenance && !manifest.repository && !pkg.repository)
        checks.push(!releasePackages.length
            ? { status: 'warn', message: '`aronrepo release` finds no published package.', fix: 'Add `"publishConfig": { "access": "public" }` to each package that ships.' }
            : withoutRepository.length
                ? { status: 'warn', message: `npm provenance needs a \`repository\` field: ${withoutRepository.map(({ name }) => name).join(', ')}.`, fix: 'Add `repository` to the root package.json.' }
                : { status: 'pass', message: `\`aronrepo release\` publishes ${releasePackages.map(({ name }) => name).join(', ')}.` })
    } catch (error) {
        checks.push({ status: 'fail', message: (error as Error).message })
    }

    const hookFile = findFile(cwd, ['.husky/commit-msg'])
    const hook = readText(hookFile).split(/\r?\n/).filter((line) => !line.trim().startsWith('#')).join('\n')
    const hooksPath = getGitConfig(cwd, 'core.hooksPath')
    if (!hook.includes('aronrepo check')) {
        checks.push({ status: 'warn', message: 'No commit-msg hook runs `aronrepo check`.', fix: `Add .husky/commit-msg with \`${cli} check --edit "$1"\`.` })
    } else if (!hooksPath?.replace(/\\/g, '/').startsWith('.husky')) {
        checks.push({ status: 'warn', message: '.husky/commit-msg is not installed; git does not run it.', fix: 'Run `husky` once, for example from the `prepare` script, to set `core.hooksPath`.' })
    } else {
        checks.push({ status: 'pass', message: '.husky/commit-msg runs aronrepo check.' })
    }

    // The policy block needs the config; a broken config is already reported above.
    if (resolved) {
        const agentsResult = await agents({ ...options, cwd, json: false })
        checks.push(agentsResult.code === 0
            ? { status: 'pass', message: 'AGENTS.md has the current commit policy block.' }
            : { status: 'fail', message: agentsResult.output.replace(/^✗ /, '').replace(/ Run `.*`\.$/, ''), fix: `${resolved.cli} agents --write` })
    }

    const failed = checks.some(({ status }) => status === 'fail')
    if (options.json) return { code: failed ? 1 : 0, output: JSON.stringify({ ok: !failed, checks }, null, 2) }
    const icon = { pass: '✓', warn: '!', fail: '✗' }
    return {
        code: failed ? 1 : 0,
        output: [
            ...checks.map(({ status, message, fix }) => `${icon[status]} ${message}${fix ? `\n    Fix: ${fix}` : ''}`),
            '',
            failed ? 'Aronrepo setup is incomplete.' : 'Aronrepo setup is complete.'
        ].join('\n')
    }
}
