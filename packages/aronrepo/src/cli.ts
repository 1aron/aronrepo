#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { releaseModes, type ReleaseMode } from './index'
import { agents, check, doctor, explain, policy, release, type CommandResult } from './commands'

const help = `Usage: aronrepo <command> [options]

Commands:
  check     Check commits against the release policy
            --edit <file>             commit-msg hook: message file + staged files
            --message <text>          a message + staged files (or --files)
            --title <text> [--base <ref> --head <ref>]   a PR title + PR diff (or --files)
            --from <ref> [--to <ref>] every commit in a range
            --files <a,b,...>         changed files, comma-separated, for --message or --title
  explain   Print the next release and the reason for each commit
            [--from <ref>] [--to <ref>]   defaults to the release range of the branch
  release   Publish the next release: npm packages, the version tag, and the GitHub release
            [--dry-run] [--branch <name>]  prints the plan and notes without changes
  policy    Print the release policy [--json | --markdown]
  agents    Check the AGENTS.md policy block, or regenerate it with --write [--file <path>]
  doctor    Check the Aronrepo setup of this repository
  help      Print this help

Options:
  --cwd <dir>                   repository root (default: the git repository around the current directory)
  --mode <explicit|auto>        override release.mode from aronrepo.config.js
  --json                        machine-readable output
  -h, --help                    print this help
  -v, --version                 print the aronrepo version
`

const options = {
    cwd: { type: 'string' },
    mode: { type: 'string' },
    json: { type: 'boolean' },
    markdown: { type: 'boolean' },
    write: { type: 'boolean' },
    file: { type: 'string' },
    edit: { type: 'string' },
    message: { type: 'string' },
    title: { type: 'string' },
    base: { type: 'string' },
    head: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
    files: { type: 'string' },
    'dry-run': { type: 'boolean' },
    branch: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' }
} as const

type OptionName = keyof typeof options

const common: OptionName[] = ['cwd', 'mode', 'json', 'help']

/** The options each command reads; any other option is a usage error instead of being ignored. */
const commandOptions: Record<string, OptionName[]> = {
    check: [...common, 'edit', 'message', 'title', 'base', 'head', 'from', 'to', 'files'],
    explain: [...common, 'from', 'to'],
    release: [...common, 'dry-run', 'branch'],
    policy: [...common, 'markdown'],
    agents: [...common, 'file', 'write'],
    doctor: common,
    help: ['help']
}

function parse(argv: string[]) {
    try {
        return parseArgs({ args: argv, allowPositionals: true, options })
    } catch (error) {
        return error as Error
    }
}

function readVersion() {
    const file = new URL('../package.json', import.meta.url)
    return (JSON.parse(fs.readFileSync(file, 'utf8')) as { version: string }).version
}

async function main(argv: string[]): Promise<CommandResult> {
    const parsed = parse(argv)
    // A usage error exits with 2 and shows the usage, like an unknown command.
    if (parsed instanceof Error) return { code: 2, output: `${parsed.message}\n\n${help}` }
    const { positionals, values } = parsed
    if (values.version) return { code: 0, output: readVersion() }
    const [command, ...extra] = positionals
    if (extra.length) return { code: 2, output: `Unexpected argument "${extra[0]}".\n\n${help}` }
    if (command === 'help' || (values.help && (!command || command in commandOptions))) return { code: 0, output: help }
    if (!command) return { code: 2, output: help }
    const allowed = commandOptions[command]
    if (!allowed) return { code: 2, output: `Unknown command "${command}".\n\n${help}` }
    const unsupported = (Object.keys(values) as OptionName[]).filter((key) => !allowed.includes(key))
    if (unsupported.length) return { code: 2, output: `\`aronrepo ${command}\` does not take --${unsupported[0]}.\n\n${help}` }
    if (values.mode && !releaseModes.includes(values.mode as ReleaseMode)) {
        return { code: 2, output: `--mode must be one of: ${releaseModes.join(', ')}` }
    }
    if (values.cwd && !fs.existsSync(values.cwd)) return { code: 2, output: `--cwd ${values.cwd} does not exist.` }
    const shared = {
        ...(values.cwd ? { cwd: values.cwd } : {}),
        ...(values.mode ? { mode: values.mode as ReleaseMode } : {}),
        ...(values.json ? { json: true } : {})
    }
    const optional = <K extends keyof typeof values>(...keys: K[]) =>
        Object.fromEntries(keys.filter((key) => values[key] !== undefined).map((key) => [key, values[key]]))

    switch (command) {
        case 'check':
            return check({
                ...shared,
                ...optional('message', 'title', 'base', 'head', 'from', 'to'),
                // A path on the command line is relative to the current directory, not to --cwd.
                ...(values.edit !== undefined ? { edit: path.resolve(values.edit) } : {}),
                ...(values.files !== undefined ? { files: values.files.split(',').map((file) => file.trim()).filter(Boolean) } : {})
            })
        case 'explain':
            return explain({ ...shared, ...optional('from', 'to') })
        case 'release':
            return release({ ...shared, ...optional('branch'), ...(values['dry-run'] ? { dryRun: true } : {}) })
        case 'policy':
            return policy({ ...shared, ...(values.markdown ? { markdown: true } : {}) })
        case 'agents':
            return agents({ ...shared, ...optional('file'), ...(values.write ? { write: true } : {}) })
        default:
            return doctor(shared)
    }
}

const json = process.argv.includes('--json')

main(process.argv.slice(2))
    .then(({ code, output }) => {
        // Reports, including failed checks, go to stdout so `--json > file` and pipes keep them; usage errors go to stderr.
        if (output) {
            const text = json && code === 2 && !output.trimStart().startsWith('{') ? JSON.stringify({ error: output.split('\n')[0], code }) : output
            const stream = code === 2 ? process.stderr : process.stdout
            stream.write(`${text}\n`)
        }
        process.exitCode = code
    })
    .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        process.stderr.write(`${json ? JSON.stringify({ error: message, code: 1 }) : message}\n`)
        process.exitCode = 1
    })
