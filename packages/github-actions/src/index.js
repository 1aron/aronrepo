const core = require('@actions/core')
const checkPRTitle = require('./check-pr-title')

switch (core.getInput('action')) {
    case 'check-pull-request-title':
        checkPRTitle()
            .catch(console.error)
        break
}