import { execSync } from 'child_process'
import path from 'path'
const parentModuleDir = path.dirname(require.main.filename)

export function run(command: string) {
    execSync(command, { cwd: parentModuleDir, stdio: 'pipe' })
}
