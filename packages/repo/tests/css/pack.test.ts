import { expectFileIncludes } from '../../../../utils/expect-file-includes'
import { expectExist } from '../../../../utils/expect-exist'
import { run } from '../../../../utils/run'

test('extract css entries from `package.json`', () => {
    run('../../dist/bin/index pack')
    expectExist(['dist/index.css'])
    expectFileIncludes('dist/index.css', ['body{background-color:red}'])
})