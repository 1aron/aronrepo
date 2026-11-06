import { consola } from 'consola'
import { defu } from 'defu'
import defaultConfig from './config'
import { queryPublicWorkspaceDirs } from './workspaces'

const COMMIT_ANALYZER = '@semantic-release/commit-analyzer'

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

    const hasCommitAnalyzer = pluginList.some((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === COMMIT_ANALYZER)
    if (hasCommitAnalyzer) {
        throw new Error([
            `Remove ${COMMIT_ANALYZER} from the release config.`,
            'Aronrepo analyzes commits with @aronrepo/semantic-release-config/analyzer; a second analyzer would release the higher of both levels and bypass the release policy.',
            'Set the release mode and release paths in aronrepo.config.js, or pass them as the analyzer plugin options.'
        ].join(' '))
    }

    for (const workspace of queryPublicWorkspaceDirs(cwd)) {
        consola.info(`Add pnpm release for ${workspace}`)
        pluginList.push(['@aronrepo/semantic-release-pnpm', { pkgRoot: workspace }])
    }

    return {
        ...merged,
        plugins: pluginList
    }
}
