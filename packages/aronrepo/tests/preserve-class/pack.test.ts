import { execSync } from 'node:child_process'
import { expectFileIncludes } from '../../../../utils/expect-file-includes'

it('preserves AAA class name', () => {
    execSync('../../dist/bin/index pack --keep-names', { cwd: __dirname, stdio: 'pipe' })
    expectFileIncludes('dist/index.mjs', [
        'AAA'
    ], { cwd: __dirname })
})