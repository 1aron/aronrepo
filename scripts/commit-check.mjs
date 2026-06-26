import { spawnSync } from 'node:child_process'

function run(command, args) {
    return spawnSync(command, args, {
        stdio: 'inherit',
        shell: process.platform === 'win32'
    })
}

const hasPreviousCommit = spawnSync('git', ['rev-parse', '--verify', 'HEAD~1'], {
    stdio: 'ignore'
}).status === 0

if (!hasPreviousCommit) {
    console.log('No previous commit found; skipping commit range check.')
    process.exit(0)
}

const result = run('commitlint', ['--from=HEAD~1', '--verbose'])
process.exit(result.status ?? 1)
