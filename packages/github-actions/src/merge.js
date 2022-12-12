const github = require('@actions/github')

module.exports = async function merge(targetBranch) {
    const client = new github.getOctokit(process.env.GITHUB_TOKEN)
    const headToMerge = process.env.GITHUB_SHA
    const repository = process.env.GITHUB_REPOSITORY

    let comparison = client.compare(
        repository,
        targetBranch,
        headToMerge
    )

    if (comparison.status == 'identical' && process.env.INPUT_DISABLE_FASTFORWARDS == 'true') {
        console.log(`Skip fastforward merge targetBranch: ${targetBranch} headToMerge: ${headToMerge}`)
    } else {
        console.log(`Running perform merge targetBranch: ${targetBranch} headToMerge: ${headToMerge}}`)

        client.merge(
            repository,
            targetBranch,
            headToMerge,
            process.env.INPUT_MESSAGE ? { commit_message: process.env.INPUT_MESSAGE } : {}
        )

        console.log(`Finish merge branch ${headToMerge} to ${targetBranch}`)
    }
}
