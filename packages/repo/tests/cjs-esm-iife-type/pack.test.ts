import { exist } from '../../../../utils/exist'
import { run } from '../../../../utils/run'

test('extract cjs, esm, iife, type entries from `package.json`', () => {
    run('aron pack')
    exist(['dist/index.cjs', 'dist/index.mjs', 'dist/index.browser.js', 'dist/index.d.ts', 'dist/index.browser.d.ts'])
})