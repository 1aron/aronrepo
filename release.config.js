/* eslint-disable @typescript-eslint/no-var-requires */
// eslint-disable-next-line no-undef
const { releaseRules } = require('semantic-release-config-aron')

// eslint-disable-next-line no-undef
module.exports = {
    extends: 'semantic-release-config-aron',
    plugins: [
        [
            '@semantic-release/commit-analyzer',
            {
                preset: 'aron',
                releaseRules
            }
        ]
    ]
}