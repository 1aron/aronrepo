const core = require('@actions/core')
const checkBranchExists = require('./check-branch-exist')
const merge = require('./merge')

module.exports = async function syncDevBranches() {
    try {
        const currentBranchName = process.env.GITHUB_REF_NAME
        const targetBranchName = `dev/${currentBranchName}`
        switch (currentBranchName) {
            case 'main':
            case 'beta':
                if (await checkBranchExists(targetBranchName)) {
                    await merge(targetBranchName)
                }
                break
        }
    } catch (error) {
        core.setOutput('error', error.message)
        core.setFailed(error.message)
    }
}
