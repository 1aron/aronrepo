const releaseRules = require('./rules')
const extend = require('to-extend').default
const fs = require('fs-extra')
const fg = require('fast-glob')
const path = require('path')

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
            prepareCmd: 'npm run check && npm run build && aron version ${nextRelease.version}'
        },
        '@semantic-release/github': true
    }
}

module.exports = (config) => {
    const { workspaces } = fs.readJSONSync(path.join(process.cwd(), 'package.json'), { throws: false }) || {}
    const workspacePaths = workspaces ? fg.sync(workspaces, { onlyFiles: false }) : null
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
    if (workspacePaths) {
        newConfig.plugins.push(
            ...workspacePaths.map((eachWorkspacePath) => ['@semantic-release/npm', {
                pkgRoot: eachWorkspacePath
            }])
        )
    }
    return newConfig
}