import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { PrepareContext } from 'semantic-release'

const execaState = vi.hoisted(() => ({
    calls: [] as Array<{
        command: string
        args: string[]
        options?: Record<string, unknown>
    }>,
    rejectWhoami: false
}))

vi.mock('execa', () => ({
    execa(command: string, args: string[], options?: Record<string, unknown>) {
        execaState.calls.push({ command, args, options })

        const shouldReject = execaState.rejectWhoami
            && command === 'pnpm'
            && args[0] === 'whoami'

        const result = shouldReject
            ? Promise.reject(new Error('401 Unauthorized'))
            : Promise.resolve({ exitCode: 0 })

        return Object.assign(result, {
            stdout: undefined,
            stderr: undefined
        })
    }
}))

import {
    buildPublishArgs,
    createAuthNpmrc,
    exchangeOidcToken,
    getChannel,
    OFFICIAL_NPM_REGISTRY,
    prepare,
    resolveRegistry,
    verifyConditions,
    writeReleaseVersion,
    type PackageJson
} from '../src'

function createFixture() {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-semantic-release-pnpm-'))
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({
        private: true,
        packageManager: 'pnpm@11.9.0'
    }, null, 4))
    fs.writeFileSync(path.join(cwd, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')
    fs.mkdirSync(path.join(cwd, 'packages/a'), { recursive: true })
    fs.mkdirSync(path.join(cwd, 'packages/b'), { recursive: true })
    fs.writeFileSync(path.join(cwd, 'packages/a/package.json'), JSON.stringify({
        name: '@fixture/a',
        version: '0.0.0',
        dependencies: {
            '@fixture/b': 'workspace:^'
        },
        publishConfig: {
            access: 'public',
            provenance: true
        }
    }, null, 4))
    fs.writeFileSync(path.join(cwd, 'packages/b/package.json'), JSON.stringify({
        name: '@fixture/b',
        version: '0.0.0',
        publishConfig: {
            access: 'public'
        }
    }, null, 4))
    return cwd
}

function createPackageFixture(name = '@fixture/package') {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-semantic-release-pnpm-package-'))
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({
        name,
        version: '0.0.0',
        publishConfig: {
            access: 'public'
        }
    }, null, 4))
    return cwd
}

function createContext(cwd: string, version = '1.2.3') {
    return {
        cwd,
        env: {},
        nextRelease: {
            version,
            channel: undefined
        },
        logger: {
            error: vi.fn(),
            log: vi.fn(),
            success: vi.fn(),
            warn: vi.fn()
        },
        stdout: process.stdout,
        stderr: process.stderr,
        options: {},
        envCi: {},
        branch: {},
        branches: [],
        commits: [],
        releases: [],
        lastRelease: {}
    } as unknown as PrepareContext
}

function runPnpm(args: string[], cwd: string) {
    return spawnSync('pnpm', args, {
        cwd,
        encoding: 'utf8',
        shell: process.platform === 'win32'
    })
}

function getProcessOutput(result: ReturnType<typeof runPnpm>) {
    return result.error?.message || result.stderr || result.stdout
}

beforeEach(() => {
    execaState.calls.length = 0
    execaState.rejectWhoami = false
    vi.unstubAllGlobals()
})

test('maps semantic-release channels to npm dist-tags', () => {
    expect(getChannel()).toBe('latest')
    expect(getChannel('beta')).toBe('beta')
    expect(getChannel('1.x')).toBe('release-1.x')
})

test('resolves registries from publishConfig, env, and npmrc', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-registry-'))
    fs.writeFileSync(path.join(cwd, '.npmrc'), '@fixture:registry=https://scoped.example.test/\nregistry=https://default.example.test/\n')

    expect(resolveRegistry({
        name: '@fixture/a',
        publishConfig: {
            registry: 'https://publish.example.test'
        }
    }, { cwd, env: {} })).toBe('https://publish.example.test/')

    expect(resolveRegistry({
        name: '@fixture/a'
    }, { cwd, env: { NPM_CONFIG_REGISTRY: 'https://env.example.test' } })).toBe('https://env.example.test/')

    expect(resolveRegistry({
        name: '@fixture/a'
    }, { cwd, env: {} })).toBe('https://scoped.example.test/')
})

test('creates npmrc auth from NPM_TOKEN without writing the token value', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-token-'))
    const context = {
        ...createContext(cwd),
        env: {
            NPM_TOKEN: 'secret-token'
        }
    }
    const npmrc = await createAuthNpmrc({ name: '@fixture/a' }, context, OFFICIAL_NPM_REGISTRY)
    expect(fs.readFileSync(npmrc, 'utf8')).toContain('//registry.npmjs.org/:_authToken=${NPM_TOKEN}')
    expect(fs.readFileSync(npmrc, 'utf8')).not.toContain('secret-token')
})

test('exchanges explicit OIDC token for an npm token', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-oidc-'))
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ token: 'npm-oidc-token' }), {
        status: 200,
        headers: {
            'content-type': 'application/json'
        }
    }))
    vi.stubGlobal('fetch', fetchMock)

    const token = await exchangeOidcToken(
        { name: '@fixture/a' },
        {
            ...createContext(cwd),
            env: {
                NPM_ID_TOKEN: 'identity-token'
            }
        },
        OFFICIAL_NPM_REGISTRY
    )

    expect(token).toBe('npm-oidc-token')
    expect(fetchMock).toHaveBeenCalledWith(
        'https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/%40fixture%2Fa',
        expect.objectContaining({
            method: 'POST',
            headers: {
                authorization: 'Bearer identity-token'
            }
        })
    )
    vi.unstubAllGlobals()
})

test('verifyConditions skips pnpm whoami after OIDC token exchange', async () => {
    const cwd = createPackageFixture('@fixture/oidc')
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ token: 'npm-oidc-token' }), {
        status: 200,
        headers: {
            'content-type': 'application/json'
        }
    }))
    vi.stubGlobal('fetch', fetchMock)
    execaState.rejectWhoami = true

    await expect(verifyConditions({}, {
        ...createContext(cwd),
        env: {
            NPM_ID_TOKEN: 'identity-token'
        }
    } as PrepareContext)).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(execaState.calls).toEqual([])
})

test('verifyConditions still validates NPM_TOKEN auth with pnpm whoami', async () => {
    const cwd = createPackageFixture('@fixture/token')

    await expect(verifyConditions({}, {
        ...createContext(cwd),
        env: {
            NPM_TOKEN: 'secret-token'
        }
    } as PrepareContext)).resolves.toBeUndefined()

    expect(execaState.calls).toHaveLength(1)
    expect(execaState.calls[0]).toEqual(expect.objectContaining({
        command: 'pnpm',
        args: ['whoami', '--registry', OFFICIAL_NPM_REGISTRY]
    }))
})

test('writes the release version only to the target package', async () => {
    const cwd = createFixture()
    await writeReleaseVersion(cwd, 'packages/a', '1.2.3')

    const packageA = JSON.parse(fs.readFileSync(path.join(cwd, 'packages/a/package.json'), 'utf8')) as PackageJson
    const packageB = JSON.parse(fs.readFileSync(path.join(cwd, 'packages/b/package.json'), 'utf8')) as PackageJson

    expect(packageA.version).toBe('1.2.3')
    expect(packageA.dependencies?.['@fixture/b']).toBe('workspace:^')
    expect(packageB.version).toBe('0.0.0')
})

test('builds the pnpm publish command', () => {
    expect(buildPublishArgs({
        basePath: '/repo/packages/a',
        distTag: 'latest',
        registry: 'https://registry.npmjs.org/',
        publishBranch: 'main',
        disableScripts: true,
        provenance: true
    })).toEqual([
        'publish',
        '/repo/packages/a',
        '--tag',
        'latest',
        '--registry',
        'https://registry.npmjs.org/',
        '--no-git-checks',
        '--publish-branch',
        'main',
        '--ignore-scripts',
        '--provenance'
    ])
})

test('pnpm pack rewrites workspace protocol dependencies after prepare', async () => {
    const cwd = createFixture()
    await prepare({ pkgRoot: 'packages/a' }, createContext(cwd))
    await prepare({ pkgRoot: 'packages/b' }, createContext(cwd))

    const install = runPnpm(['install', '--offline'], cwd)
    expect(install.status, getProcessOutput(install)).toBe(0)

    const pack = runPnpm(['pack', '--pack-destination', cwd], path.join(cwd, 'packages/a'))
    expect(pack.status, getProcessOutput(pack)).toBe(0)

    const tarball = pack.stdout.trim().split('\n').at(-1)
    expect(path.basename(tarball ?? '')).toBe('fixture-a-1.2.3.tgz')

    const tar = spawnSync('tar', ['-xOf', tarball ?? '', 'package/package.json'], {
        encoding: 'utf8'
    })
    expect(tar.status, tar.stderr || tar.stdout).toBe(0)

    const packedPackage = JSON.parse(tar.stdout) as PackageJson
    expect(packedPackage.dependencies?.['@fixture/b']).toBe('^1.2.3')
})
