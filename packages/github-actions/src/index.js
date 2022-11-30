const core = require('@actions/core')
const { checkPRTitle } = require('./pr-title-check')

switch (core.getInput('action')) {
    case 'check-pull-request-title':
        checkPRTitle()
            .catch(console.error)
        break
}