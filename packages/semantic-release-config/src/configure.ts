import { consola } from 'consola'
import { defu } from 'defu'
import defaultConfig from './config'
import { queryWorkspaceDirs, readWorkspacePackage, readWorkspacePatterns } from './workspaces'

type SemanticReleasePluginMap = Record<string, boolean | Record<string, unknown>>

interface SemanticReleaseConfig {
    branches?: unknown[]
    plugins?: SemanticReleasePluginMap | unknown[]
    [key: string]: unknown
}

function normalizePlugins(plugins: SemanticReleasePluginMap) {
    return Object.entries(plugins)
        .map(([pluginName, pluginConfig]) => {
            if (pluginConfig === true) return pluginName
            if (pluginConfig) return [pluginName, pluginConfig]
            return null
        })
        .filter(Boolean)
}

export default function configure(config: SemanticReleaseConfig = {}) {
    const cwd = process.cwd()
    const merged = defu(config, defaultConfig) as SemanticReleaseConfig & { plugins: SemanticReleasePluginMap | unknown[] }
    const pluginList = Array.isArray(merged.plugins)
        ? merged.plugins
        : normalizePlugins(merged.plugins)

    for (const workspace of queryWorkspaceDirs(readWorkspacePatterns(cwd), cwd)) {
        const pkg = readWorkspacePackage(cwd, workspace)
        if (pkg.publishConfig?.access === 'public') {
            consola.info(`Add pnpm release for ${workspace}`)
            pluginList.push(['@aronrepo/semantic-release-pnpm', { pkgRoot: workspace }])
        }
    }

    return {
        ...merged,
        plugins: pluginList
    }
}
