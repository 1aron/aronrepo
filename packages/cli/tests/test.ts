import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { runVersion } from '../src'

test('exports command runners', () => {
    expect(typeof runVersion).toBe('function')
})

test('prints usage without build or dev commands', () => {
    const binPath = path.resolve(process.cwd(), 'dist/bin/index.js')
    const result = spawnSync(process.execPath, [binPath, '--help'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
            ...process.env,
            CONSOLA_LEVEL: '3',
            NODE_ENV: 'development'
        }
    })
    const output = `${result.stdout}${result.stderr}`

    expect(result.status).toBe(0)
    expect(output).toContain('Usage: aronrepo <version> [...flags]')
    expect(output).not.toContain('build')
    expect(output).not.toContain('dev')
})
