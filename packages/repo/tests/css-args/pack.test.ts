import { expectExist } from '../../../../utils/expect-exist'
import { run } from '../../../../utils/run'

test('specify css entries', () => {
    run('npx aron pack src/*.css')
    expectExist(['dist/index.css', 'dist/float.css', 'dist/heart.css'])
})