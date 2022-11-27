import { execaCommand } from 'execa'

test('cjs esm iife', () => {
    execaCommand('npm run pack')
})