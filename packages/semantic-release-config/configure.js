const releaseRules = require('./rules')
const extend = require('to-extend').default

const defaultConfig = {
    branches: [
        '+([0-9])?(.{+([0-9]),x}).x',
        'main',
        'next',
        'next-major',
        {
            name: 'beta',
            prerelease: true
        },
        {
            name: 'alpha',
            prerelease: true
        }
    ],
    plugins: {
        '@semantic-release/commit-analyzer': { preset: 'aron', releaseRules },
        '@semantic-release/release-notes-generator': { preset: 'aron' },
        '@semantic-release/exec': {
            prepareCmd: 'npm run check && npm run build',
            publishCmd: 'aron version ${nextRelease.version}'
        },
        '@semantic-release/npm': true,
        '@semantic-release/github': true
    }
}

module.exports = (config) => {
    const newConfig = extend(defaultConfig, config)
    newConfig.plugins = Object.keys(newConfig.plugins)
        .map((eachPluginName) => {
            const eachPluginConfig = newConfig.plugins[eachPluginName]
            if (eachPluginConfig === true) {
                return eachPluginName
            } else if (eachPluginConfig) {
                return [eachPluginName, eachPluginConfig]
            } else {
                return null
            }
        })
        .filter((eachPlugin) => eachPlugin)
    return newConfig
}