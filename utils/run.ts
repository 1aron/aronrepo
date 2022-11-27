import { commandSync } from 'execa'
import path from 'path'
const parentModuleDir = path.dirname(require.main.filename)

export function run(command: string) {
    commandSync(command, { cwd: parentModuleDir, stdio: 'pipe' })
}
