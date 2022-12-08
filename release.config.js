const configure = require('semantic-release-config-aron/configure')

module.exports = configure({
    plugins: {
        '@semantic-release/exec': {
            prepareCmd: 'npm run check && npm run version ${nextRelease.version}'
        }
    }
})