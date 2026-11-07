import { getBaseTag, getNextVersion, getReleaseChannel, parseVersionTag, type ReleaseChannel } from '../src'

const main = getReleaseChannel('main')!
const beta = getReleaseChannel('beta')!

test('maps release branches to channels', () => {
    expect(main).toEqual({ branch: 'main', distTag: 'latest' })
    expect(beta).toEqual({ branch: 'beta', distTag: 'beta', prerelease: 'beta' })
    expect(getReleaseChannel('next')).toBeUndefined()
    expect(getReleaseChannel('feature/x')).toBeUndefined()
})

test('parses version tags only', () => {
    expect(parseVersionTag('v2.2.1')).toBe('2.2.1')
    expect(parseVersionTag('v3.0.0-beta.2')).toBe('3.0.0-beta.2')
    expect(parseVersionTag('2.2.1')).toBeUndefined()
    expect(parseVersionTag('v2.2')).toBeUndefined()
    expect(parseVersionTag('candidate-2.2.1')).toBeUndefined()
})

test('starts the range at the latest stable tag on main', () => {
    expect(getBaseTag(main, ['v1.6.0', 'v2.2.1', 'v2.2.0', 'v3.0.0-beta.1'])).toBe('v2.2.1')
    expect(getBaseTag(main, [])).toBeUndefined()
})

test('starts a prerelease range at the latest prerelease of the channel', () => {
    expect(getBaseTag(beta, ['v2.2.1', 'v3.0.0-beta.1', 'v3.0.0-alpha.4'])).toBe('v3.0.0-beta.1')
    expect(getBaseTag(beta, ['v2.2.1', 'v2.2.1-beta.1'])).toBe('v2.2.1')
})

test('raises the latest stable version on main', () => {
    const tags = { reachable: ['v2.2.1', 'v3.0.0-beta.2'], all: ['v2.2.1', 'v3.0.0-beta.2'] }
    expect(getNextVersion(main, 'major', tags)).toBe('3.0.0')
    expect(getNextVersion(main, 'minor', tags)).toBe('2.3.0')
    expect(getNextVersion(main, 'patch', tags)).toBe('2.2.2')
    expect(getNextVersion(main, 'patch', { reachable: [], all: [] })).toBe('1.0.0')
})

test('numbers prereleases and keeps their target version', () => {
    const channel: ReleaseChannel = beta
    expect(getNextVersion(channel, 'patch', { reachable: ['v2.2.1'], all: ['v2.2.1'] })).toBe('2.2.2-beta.1')
    expect(getNextVersion(channel, 'major', { reachable: ['v2.2.1', 'v2.2.2-beta.1'], all: ['v2.2.1', 'v2.2.2-beta.1'] })).toBe('3.0.0-beta.1')
    expect(getNextVersion(channel, 'patch', { reachable: ['v2.2.1', 'v3.0.0-beta.1'], all: ['v2.2.1', 'v3.0.0-beta.1'] })).toBe('3.0.0-beta.2')
    expect(getNextVersion(channel, 'patch', {
        reachable: ['v2.2.1', 'v3.0.0-beta.1'],
        all: ['v2.2.1', 'v3.0.0-beta.1', 'v3.0.0-beta.3', 'v3.0.0-alpha.9']
    })).toBe('3.0.0-beta.4')
    expect(getNextVersion(channel, 'patch', { reachable: ['v3.0.0', 'v3.0.0-beta.4'], all: ['v3.0.0', 'v3.0.0-beta.4'] })).toBe('3.0.1-beta.1')
})
