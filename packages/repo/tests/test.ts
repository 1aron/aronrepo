import { packages } from '../src'

test('lists facade packages', () => {
    const removedBuildPackage = '@aronrepo/' + 'build'

    expect(packages).toContain('@aronrepo/cli')
    expect(packages).toContain('@aronrepo/version')
    expect(packages).not.toContain(removedBuildPackage)
})
