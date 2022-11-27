import { execSync } from 'child_process'

test('cjs esm iife', () => {
    execSync('npm run pack', { cwd: __dirname, stdio: 'inherit' })
})