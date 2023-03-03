import { execSync } from 'node:child_process'
import { expectExist } from '../../../../utils/expect-exist'
import dedent from 'ts-dedent'

it('deeply outputs src directory', () => {
    execSync('../../dist/bin/index pack', { cwd: __dirname, stdio: 'pipe' })
    expectExist([
        'dist/index.cjs',
        'dist/index.mjs',
        'dist/components/index.cjs',
        'dist/components/index.mjs',
        'dist/components/a.cjs',
        'dist/components/a.mjs',
        'dist/components/b.cjs',
        'dist/components/b.mjs',
    ])
})

it('only bundles A component', () => {
    expect(
        execSync('esbuild project/main.ts --bundle', { cwd: __dirname, stdio: 'pipe' }).toString()
    ).toEqual(dedent`
        (() => {
          // dist/index.mjs
          function t() {
            return "A";
          }
          var r = 1;
          alert(r);

          // project/main.ts
          console.log(t());
        })();\n
    `)
})