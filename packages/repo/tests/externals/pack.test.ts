import { expectFileIncludes } from '../../../../utils/expect-file-includes'
import { run } from '../../../../utils/run'

test('prevent bundling deps and peerDeps by `package.json`', () => {
    run('npx aron pack --platform=node')
    expectFileIncludes('dist/index.cjs', [
        'require("@master/css")',
        'require("@master/style-element.react")'
    ])
})