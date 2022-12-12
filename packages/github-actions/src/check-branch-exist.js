const github = require('@actions/github')

module.exports = async function checkBranchExists(branchName) {
    try {
        const gh = new github.GitHub(process.env.GITHUB_TOKEN)
        const repository = process.env.GITHUB_REPOSITORY
        const [owner = null, repo = null] = repository.split('/')
        await gh.repos.getBranch({
            repo,
            branchName,
            owner
        })
        return true
    } catch (e) {
        if (e.message === 'Branch not found') {
            return false
        }
        throw new Error(`Failed to get branch: ${e.message}`)
    }
}
