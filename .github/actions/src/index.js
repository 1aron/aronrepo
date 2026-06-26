import core from '@actions/core'
import checkPRTitle from './check-pr-title.js'

switch (core.getInput('action')) {
    case 'check-pull-request-title':
        await checkPRTitle()
        break
    default:
        core.setFailed(`Unknown action: ${core.getInput('action')}`)
}
