import conventionalCommits from 'aron-conventional-commits'

export const releaseRules = [
    { breaking: true, release: 'major' },
    { revert: true, release: 'patch' },
    ...(JSON.parse(JSON.stringify(conventionalCommits)) as [])
        .map((eachReleaseRule: any) => {
            delete eachReleaseRule.group
            return eachReleaseRule
        })
]