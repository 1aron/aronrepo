import { execSync } from 'node:child_process'
import { expectFileIncludes } from '../../../../utils/expect-file-includes'

test('prevent bundling deps and peerDeps by args', () => {
    execSync('node ../../dist/bin/index pack --externals @master/css @master/style-element.react', { cwd: __dirname, stdio: 'pipe' })
    expectFileIncludes('dist/index.cjs', [
        'require("@master/css")',
        'require("@master/style-element.react")'
    ])
})