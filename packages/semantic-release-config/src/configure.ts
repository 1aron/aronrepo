import path from 'node:path'
import { consola } from 'consola'
import { defu } from 'defu'
import fs from 'fs-extra'
import { explorePackageManager, queryWorkspaces, readPNPMWorkspaces, readWorkspaces, type PackageJson } from '@aronrepo/npm'
import defaultConfig from './config'

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

function resolveWorkspaces(cwd: string) {
    switch (explorePackageManager({ cwd })) {
        case 'pnpm':
            return readPNPMWorkspaces({ cwd }) ?? []
        case 'npm':
            return readWorkspaces({ cwd }) ?? []
        default:
            return []
    }
}

export default function configure(config: SemanticReleaseConfig = {}) {
    const cwd = process.cwd()
    const merged = defu(config, defaultConfig) as SemanticReleaseConfig & { plugins: SemanticReleasePluginMap | unknown[] }
    const pluginList = Array.isArray(merged.plugins)
        ? merged.plugins
        : normalizePlugins(merged.plugins)

    for (const workspace of queryWorkspaces(resolveWorkspaces(cwd), { cwd })) {
        const pkg = fs.readJsonSync(path.join(cwd, workspace, 'package.json')) as PackageJson
        if (pkg.publishConfig?.access === 'public') {
            consola.info(`Add npm release for ${workspace}`)
            pluginList.push(['@semantic-release/npm', { pkgRoot: workspace }])
        }
    }

    return {
        ...merged,
        plugins: pluginList
    }
}
