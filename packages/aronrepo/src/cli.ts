#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { releaseModes, type ReleaseMode } from './index'
import { agents, check, doctor, explain, policy, release, type CommandResult } from './commands'

const help = `Usage: aronrepo <command> [options]

Commands:
  check     Check commits against the release policy
            --edit <file>             commit-msg hook: message file + staged files
            --message <text>          a message + staged files (or --files)
            --title <text> [--base <ref> --head <ref>]   a PR title + PR diff
            --from <ref> [--to <ref>] every commit in a range
  explain   Print the next release and the reason for each commit
            [--from <ref>] [--to <ref>]   defaults to the release range of the branch
  release   Publish the next release: npm packages, the version tag, and the GitHub release
            [--dry-run] [--branch <name>]  prints the plan and notes without changes
  policy    Print the release policy [--json | --markdown]
  agents    Check the AGENTS.md policy block, or regenerate it with --write [--file <path>]
  doctor    Check the Aronrepo setup of this repository

Options:
  --cwd <dir>                   repository root (default: current directory)
  --mode <explicit|auto>        override release.mode from aronrepo.config.js
  --json                        machine-readable output
`

async function main(argv: string[]): Promise<CommandResult> {
    const { positionals, values } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            cwd: { type: 'string' },
            mode: { type: 'string' },
            json: { type: 'boolean' },
            markdown: { type: 'boolean' },
            write: { type: 'boolean' },
            check: { type: 'boolean' },
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
            help: { type: 'boolean', short: 'h' }
        }
    })
    const [command] = positionals
    if (!command || values.help) return { code: command || values.help ? 0 : 2, output: help }
    if (values.mode && !releaseModes.includes(values.mode as ReleaseMode)) {
        return { code: 2, output: `--mode must be one of: ${releaseModes.join(', ')}` }
    }
    const common = {
        ...(values.cwd ? { cwd: values.cwd } : {}),
        ...(values.mode ? { mode: values.mode as ReleaseMode } : {}),
        ...(values.json ? { json: true } : {})
    }
    const optional = <K extends keyof typeof values>(...keys: K[]) =>
        Object.fromEntries(keys.filter((key) => values[key] !== undefined).map((key) => [key, values[key]]))

    switch (command) {
        case 'check':
            return check({
                ...common,
                ...optional('edit', 'message', 'title', 'base', 'head', 'from', 'to'),
                ...(values.files !== undefined ? { files: values.files.split(',').map((file) => file.trim()).filter(Boolean) } : {})
            })
        case 'explain':
            return explain({ ...common, ...optional('from', 'to') })
        case 'release':
            return release({ ...common, ...optional('branch'), ...(values['dry-run'] ? { dryRun: true } : {}) })
        case 'policy':
            return policy({ ...common, ...(values.markdown ? { markdown: true } : {}) })
        case 'agents':
            return agents({ ...common, ...optional('file'), ...(values.write ? { write: true } : {}) })
        case 'doctor':
            return doctor(common)
        default:
            return { code: 2, output: `Unknown command "${command}".\n\n${help}` }
    }
}

main(process.argv.slice(2))
    .then(({ code, output }) => {
        if (output) (code === 0 ? process.stdout : process.stderr).write(`${output}\n`)
        process.exitCode = code
    })
    .catch((error: unknown) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
        process.exitCode = 1
    })
