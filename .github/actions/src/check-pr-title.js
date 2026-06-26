import core from '@actions/core'
import github from '@actions/github'
import validateTitle from './validate-title.js'

export default async function checkPRTitle() {
    try {
        const contextName = core.getInput('pr-title-check-name')
        const successState = core.getInput('pr-title-check-valid-message')
        const failureState = core.getInput('pr-title-check-invalid-message')
        const targetUrl = core.getInput('pr-title-check-detail-url')
        const client = github.getOctokit(process.env.GITHUB_TOKEN)
        const contextPullRequest = github.context.payload.pull_request

        if (!contextPullRequest) {
            throw new Error('This action can only be invoked in pull request events.')
        }

        let error = null
        try {
            await validateTitle(contextPullRequest.title)
        } catch (caught) {
            error = caught
        }

        core.setOutput('success', String(error === null))

        await client.request('POST /repos/{owner}/{repo}/statuses/{sha}', {
            owner: contextPullRequest.base.user.login,
            repo: contextPullRequest.base.repo.name,
            sha: contextPullRequest.head.sha,
            state: error ? 'failure' : 'success',
            description: error ? failureState : successState,
            target_url: targetUrl,
            context: contextName
        })

        if (error) throw error
    } catch (error) {
        core.setOutput('error', error.message)
        core.setFailed(error.message)
    }
}
