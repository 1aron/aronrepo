import { execSync } from 'node:child_process'
import { expectExist } from '../../../../utils/expect-exist'

test('extract cjs, esm, iife, type entries from `package.json`', () => {
    execSync('../../dist/bin/index pack', { cwd: __dirname, stdio: 'pipe' })
    expectExist(['dist/index.cjs', 'dist/index.mjs', 'dist/index.browser.js', 'dist/index.d.ts', 'dist/index.browser.d.ts'])
})