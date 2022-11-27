import { exist } from '../../../../utils/exist'
import { run } from '../../../../utils/run'

test('extract css entries from `package.json`', () => {
    run('aron pack')
    exist(['dist/index.css'])
})