import { packages } from '../src'

test('lists facade packages', () => {
    const removedBuildPackage = '@aronrepo/' + 'build'

    expect(packages).toContain('@aronrepo/semantic-release-pnpm')
    expect(packages).not.toContain('@aronrepo/cli')
    expect(packages).not.toContain('@aronrepo/version')
    expect(packages).not.toContain('@aronrepo/npm')
    expect(packages).not.toContain(removedBuildPackage)
})
