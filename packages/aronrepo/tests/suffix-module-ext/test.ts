import { execSync } from 'node:child_process'
import { expectFileIncludes } from '../../../../utils/expect-file-includes'

it('suffix es module with outext', () => {
    execSync('../../dist/bin/index pack --no-minify', { cwd: __dirname, stdio: 'pipe' })
    expectFileIncludes('dist/esm/a.js', [
        '"./b.js"',
        '"./d/index.js"',
        '"./c.js"'
    ], { cwd: __dirname })
    expectFileIncludes('dist/esm/d/index.js', [
        '"../e.js"',
        '"../f/ff.js"'
    ], { cwd: __dirname })
})

