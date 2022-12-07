const configure = require('semantic-release-config-aron/configure')

module.exports = configure({
    scripts: {
        prepare: 'npm run check',
        publish: 'npm run version ${nextRelease.version}'
    }
})