import { execSync } from 'node:child_process'
import { expectFileExcludes } from '../../../../utils/expect-file-excludes'
import { expectFileIncludes } from '../../../../utils/expect-file-includes'

execSync('../../dist/bin/index pack --no-minify', { cwd: __dirname, stdio: 'pipe' })

it('mangle private', () => {
    expectFileExcludes('dist/index.mjs', [
        '_fullAAAMembership'
    ], { cwd: __dirname })
})

it('tree shake and only bundle AAA', () => {
    execSync('../../dist/bin/index pack src/tree-shaking.ts --no-minify --no-clean', { cwd: __dirname, stdio: 'pipe' })
    expectFileExcludes('dist/tree-shaking.mjs', [
        'BBB'
    ], { cwd: __dirname })
})