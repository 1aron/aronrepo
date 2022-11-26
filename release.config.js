const configure = require('semantic-release-config-aron/configure')

module.exports = configure({
    scripts: {
        prepare: 'npm run check && npm run build',
        publish: 'npm run version ${nextRelease.version} && npm publish --workspaces --access public'
    }
})