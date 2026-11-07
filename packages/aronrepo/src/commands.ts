import fs from 'node:fs'
import path from 'node:path'
import {
    agentsBlockEnd,
    agentsBlockStart,
    commits,
    getReleaseType,
    legacyCommits,
    defaultReleasePathExcludes,
    getAgentCommitPolicy,
    getReleaseTable,
    parseCommit,
    renderAgentsBlock,
    resolveCommitRelease,
    resolveRelease,
    type CommitDecision,
    type CommitViolation,
    type ReleaseMode
} from './index'
import {
    getDiffFiles,
    getLatestTag,
    getRangeCommits,
    getStagedFiles,
    loadProjectPolicy,
    type ProjectPolicy
} from './project'

export interface CommandResult {
    code: number
    output: string
}

export interface CommonOptions {
    cwd?: string
    mode?: ReleaseMode
    json?: boolean
}

// Messages that git or GitHub write for you; commitlint ignores the same ones by default.
const ignoredMessagePatterns = [
    /^Merge pull request /,
    /^Merge (?:branch|remote-tracking branch|tag) /,
    /^Merge .+ into .+/,
    /^Merged .+ (?:in|into) .+/,
    /^Automatic merge/,
    /^Auto-merged .+ into .+/,
    /^(?:fixup|squash|amend)! /,
    /^Initial commit$/
]

export function isIgnoredMessage(message: string) {
    const header = message.trim().split('\n')[0] ?? ''
    return ignoredMessagePatterns.some((pattern) => pattern.test(header))
}

function readEditMessage(file: string) {
    return fs.readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => !line.startsWith('#'))
        .join('\n')
        .split(/^-+ >8 -+$/m)[0]
        .trim()
}

async function project(options: CommonOptions): Promise<ProjectPolicy> {
    return loadProjectPolicy(options.cwd ?? process.cwd(), options.mode ? { mode: options.mode } : {})
}

function formatViolation(violation: CommitViolation) {
    return `  ✗ ${violation.message}${violation.suggestion ? `\n    Suggested header: ${violation.suggestion}` : ''}`
}

function formatDecision(decision: CommitDecision) {
    const hash = decision.hash ? `${decision.hash.slice(0, 9)} ` : ''
    return `${hash}${(decision.release || 'none').padEnd(5)}  ${decision.header}\n${decision.reasons.map((reason) => `       ${reason}`).join('\n')}`
}

export interface CheckOptions extends CommonOptions {
    /** Commit message file, as passed to a commit-msg hook. Uses staged files. */
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
    const cwd = options.cwd ?? process.cwd()
    const { policy, isReleasePath } = await project(options)
    const pathOptions = isReleasePath ? { isReleasePath } : {}
    let entries: Array<{ message: string, hash?: string, files?: string[], label: string }>

    if (options.title !== undefined) {
        const files = options.files ?? (options.base && options.head ? getDiffFiles(cwd, options.base, options.head) : undefined)
        entries = [{ message: options.title, ...(files ? { files } : {}), label: 'PR title' }]
    } else if (options.edit || options.message !== undefined) {
        const message = options.edit ? readEditMessage(path.resolve(cwd, options.edit)) : options.message!
        entries = [{ message, files: options.files ?? getStagedFiles(cwd), label: 'Commit message' }]
    } else if (options.from) {
        entries = getRangeCommits(cwd, options.from, options.to ?? 'HEAD')
            .map((commit) => ({ ...commit, label: commit.hash.slice(0, 9) }))
    } else {
        return { code: 2, output: 'Pass --edit <file>, --message <text>, --title <text>, or --from <ref>.' }
    }

    const results = entries
        .filter(({ message }) => !isIgnoredMessage(message))
        .map((entry) => ({
            entry,
            decision: resolveCommitRelease(parseCommit(entry.message, entry.hash), policy, {
                ...pathOptions,
                ...(entry.files ? { files: entry.files } : {})
            })
        }))
    const failures = results.filter(({ decision }) => decision.violations.length)

    if (options.json) {
        return {
            code: failures.length ? 1 : 0,
            output: JSON.stringify({ mode: policy.mode, results: results.map(({ entry, decision }) => ({ label: entry.label, ...decision })) }, null, 2)
        }
    }
    if (!failures.length) {
        return {
            code: 0,
            output: [
                ...results.map(({ entry, decision }) => `✓ ${entry.label}: ${decision.release || 'none'} ← ${decision.header}`),
                `${results.length} ${results.length === 1 ? 'header follows' : 'headers follow'} the Aronrepo ${policy.mode} release policy.`
            ].join('\n')
        }
    }
    return {
        code: 1,
        output: [
            ...failures.map(({ entry, decision }) => `${entry.label}: ${decision.header}\n${decision.violations.map(formatViolation).join('\n')}`),
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
    const cwd = options.cwd ?? process.cwd()
    const { policy, isReleasePath, releasePaths } = await project(options)
    const to = options.to ?? 'HEAD'
    const from = options.from ?? getLatestTag(cwd, to)
    const commits = getRangeCommits(cwd, from, to)
    const decision = resolveRelease(commits, policy, isReleasePath ? { isReleasePath } : {})

    if (options.json) {
        return { code: 0, output: JSON.stringify({ mode: policy.mode, from: from ?? null, to, releasePaths: releasePaths ?? null, ...decision }, null, 2) }
    }
    return {
        code: 0,
        output: [
            `Range: ${from ? `${from}..${to}` : `all commits up to ${to}`}`,
            `Mode: ${policy.mode}`,
            `Release paths: ${releasePaths?.include ? releasePaths.include.join(', ') : 'every path'}`,
            '',
            ...(decision.commits.length ? decision.commits.map(formatDecision) : ['No commits.']),
            '',
            `Next release: ${decision.release || 'none'}`
        ].join('\n')
    }
}

export async function policy(options: CommonOptions & { markdown?: boolean }): Promise<CommandResult> {
    const resolved = await project(options)
    if (options.markdown) {
        return { code: 0, output: renderAgentsBlock(resolved.policy, { cli: resolved.cli, ...(resolved.releasePaths ? { releasePaths: resolved.releasePaths } : {}) }) }
    }
    const data = {
        mode: resolved.policy.mode,
        configFile: resolved.configFile ? path.relative(resolved.cwd, resolved.configFile) : null,
        releasePaths: resolved.releasePaths ?? null,
        releaseTable: getReleaseTable(resolved.policy),
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
            `Major: ${data.releaseTable.major.join(', ') || '-'}`,
            `Minor: ${data.releaseTable.minor.join(', ') || '-'}`,
            `Patch: ${data.releaseTable.patch.join(', ') || '-'}`,
            `None:  ${data.releaseTable.none.join(', ') || '-'}`,
            '',
            ...data.agent.ownerDecisions.map((rule) => `- ${rule}`)
        ].join('\n')
    }
}

export function replaceAgentsBlock(content: string, block: string) {
    const start = content.indexOf(agentsBlockStart)
    const end = content.indexOf(agentsBlockEnd)
    if (start !== -1 && end > start) {
        return content.slice(0, start) + block + content.slice(end + agentsBlockEnd.length)
    }
    return `${content.trimEnd()}${content.trim() ? '\n\n' : ''}${block}\n`
}

export function readAgentsBlock(content: string) {
    const start = content.indexOf(agentsBlockStart)
    const end = content.indexOf(agentsBlockEnd)
    return start !== -1 && end > start ? content.slice(start, end + agentsBlockEnd.length) : undefined
}

export async function agents(options: CommonOptions & { file?: string, write?: boolean }): Promise<CommandResult> {
    const resolved = await project(options)
    const file = path.resolve(resolved.cwd, options.file ?? 'AGENTS.md')
    const relative = path.relative(resolved.cwd, file)
    const block = renderAgentsBlock(resolved.policy, { cli: resolved.cli, ...(resolved.releasePaths ? { releasePaths: resolved.releasePaths } : {}) })
    const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''

    if (options.write) {
        const next = replaceAgentsBlock(content || '# Agent Guide\n', block)
        if (next === content) return { code: 0, output: `✓ ${relative} is up to date.` }
        fs.writeFileSync(file, next)
        return { code: 0, output: `✓ Wrote the Aronrepo commit policy block to ${relative}.` }
    }
    const current = readAgentsBlock(content)
    if (current === block) return { code: 0, output: `✓ ${relative} has the current Aronrepo commit policy block.` }
    return {
        code: 1,
        output: `✗ ${relative} ${current ? 'has an outdated' : 'is missing the'} Aronrepo commit policy block. Run \`aronrepo agents --write\`.`
    }
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
    '.',
    '@aronrepo/semantic-release-config',
    '@aronrepo/semantic-release-pnpm'
]

const legacyConfigFiles = [
    'release.config.js', 'release.config.mjs', 'release.config.cjs', '.releaserc', '.releaserc.js', '.releaserc.mjs', '.releaserc.json',
    'commitlint.config.js', 'commitlint.config.mjs', 'commitlint.config.ts', '.commitlintrc', '.commitlintrc.js', '.commitlintrc.mjs', '.commitlintrc.json'
]

export async function doctor(options: CommonOptions): Promise<CommandResult> {
    const cwd = options.cwd ?? process.cwd()
    const checks: DoctorCheck[] = []
    let resolved: ProjectPolicy | undefined

    try {
        resolved = await project(options)
        checks.push(resolved.configFile
            ? { status: 'pass', message: `Release mode ${resolved.policy.mode} from ${path.relative(cwd, resolved.configFile)}.` }
            : {
                status: 'warn',
                message: `No aronrepo.config.js; using the default ${resolved.policy.mode} mode.`,
                fix: 'Ask the repository owner whether releases are explicit (owner-controlled) or auto, then create aronrepo.config.js with `release.mode`.'
            })
    } catch (error) {
        checks.push({ status: 'fail', message: `aronrepo.config.js failed to load: ${(error as Error).message}` })
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

    const pkg = JSON.parse(readText(findFile(cwd, ['package.json'])) || '{}') as Record<string, Record<string, string> | undefined>
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies }
    checks.push(dependencies.aronrepo
        ? { status: 'pass', message: 'aronrepo is installed.' }
        : { status: 'fail', message: 'aronrepo is not a dependency.', fix: 'Install it as a dev dependency, for example `bun add -d aronrepo`.' })

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

    const hook = readText(findFile(cwd, ['.husky/commit-msg']))
    checks.push(hook.includes('aronrepo check')
        ? { status: 'pass', message: '.husky/commit-msg runs aronrepo check.' }
        : {
            status: 'warn',
            message: 'No commit-msg hook runs `aronrepo check`.',
            fix: 'Add .husky/commit-msg with `aronrepo check --edit "$1"`.'
        })

    const agentsResult = await agents({ ...options, cwd })
    checks.push(agentsResult.code === 0
        ? { status: 'pass', message: 'AGENTS.md has the current commit policy block.' }
        : { status: 'fail', message: agentsResult.output.replace(/^✗ /, ''), fix: 'aronrepo agents --write' })

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
