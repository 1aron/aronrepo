const core = require('@actions/core')
const github = require('@actions/github')
const npa = require('npm-package-arg')
const installPreset = require('./install-preset')
const validateTitle = require('./validate-title')

async function run() {
    try {
        let contextName = core.getInput('pr-title-check-name')
        let successState = core.getInput('pr-title-check-valid-message')
        let failureState = core.getInput('pr-title-check-invalid-message')
        let targetUrl = core.getInput('pr-title-check-detail-url')
        const installPresetPackage = 'conventional-changelog-aron'
        const requirePresetPackage = npa(installPresetPackage).name

        const client = new github.getOctokit(process.env.GITHUB_TOKEN)

        const contextPullRequest = github.context.payload.pull_request
        if (!contextPullRequest) {
            throw new Error(
                'This action can only be invoked in `pull_request` events. Otherwise the pull request can\'t be inferred.'
            )
        }

        const owner = contextPullRequest.base.user.login
        const repo = contextPullRequest.base.repo.name

        let error = null
        try {
            await installPreset(installPresetPackage)
            await validateTitle(contextPullRequest.title)
        } catch (err) {
            error = err
        }

        core.setOutput('success', (error === null).toString())

        let state = 'success'
        let description = successState
        if (error) {
            state = 'failure'
            description = failureState
        }

        await client.request(
            'POST /repos/:owner/:repo/statuses/:sha',
            {
                owner,
                repo,
                state,
                description,
                sha: contextPullRequest.head.sha,
                target_url: targetUrl,
                context: contextName,
            },
        )

        if (error) {
            throw error
        } else {
            console.log(`${state}: ${description}`)
        }

    } catch (error) {
        core.setOutput('error', error.message)
        core.setFailed(error.message)
    }
}

run().catch(console.error)
