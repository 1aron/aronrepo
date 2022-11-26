const configure = require('semantic-release-config-aron/configure')

module.exports = configure({
    scripts: {
        prepare: 'npm run check',
        publish: 'aron version ${nextRelease.version} && npm publish --workspaces --access public'
    }
})