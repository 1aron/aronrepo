const configure = require('semantic-release-config-aron/configure')

module.exports = configure({
    scripts: {
        prepareCmd: 'npm run check && aron version ${nextRelease.version}'
    }
})