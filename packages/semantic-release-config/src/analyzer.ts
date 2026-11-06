import {
    createReleasePathMatcher,
    getReleasePolicy,
    resolveRelease,
    type CommitDecision,
    type ReleaseMode,
    type ReleasePathsConfig
} from '@aronrepo/conventional-commits'
import { getCommitFiles, loadConfig, resolveReleasePaths } from '@aronrepo/conventional-commits/node'

export interface AnalyzerConfig {
    /** Overrides `release.mode` from `aronrepo.config.js`. */
    mode?: ReleaseMode
    /** Overrides `release.paths` from `aronrepo.config.js`. */
    paths?: ReleasePathsConfig | false
}

interface AnalyzerContext {
    cwd?: string
    commits?: Array<{ hash?: string, commit?: { long?: string }, message?: string }>
    logger?: { log: (...args: unknown[]) => void, warn?: (...args: unknown[]) => void }
}

function describe(decision: CommitDecision) {
    const hash = decision.hash ? decision.hash.slice(0, 9) : '?'
    return `${hash} ${decision.release || 'none'} ← ${decision.header} — ${decision.reasons.join(' ')}`
}

/**
 * semantic-release `analyzeCommits` step that follows the Aronrepo release policy.
 *
 * It replaces `@semantic-release/commit-analyzer` so that no default Angular, ESLint,
 * or breaking-change rule can raise the version behind the policy's back.
 */
export async function analyzeCommits(pluginConfig: AnalyzerConfig = {}, context: AnalyzerContext = {}) {
    const cwd = context.cwd ?? process.cwd()
    const config = await loadConfig(cwd)
    const policy = getReleasePolicy({
        release: {
            ...config.release,
            ...(pluginConfig.mode ? { mode: pluginConfig.mode } : {}),
            ...(pluginConfig.paths !== undefined ? { paths: pluginConfig.paths } : {})
        }
    })
    const releasePaths = resolveReleasePaths(cwd, policy)
    const isReleasePath = createReleasePathMatcher(releasePaths)
    const commits = (context.commits ?? []).map((commit) => {
        const hash = commit.hash ?? commit.commit?.long
        return {
            message: commit.message ?? '',
            ...(hash ? { hash, files: getCommitFiles(cwd, hash) } : {})
        }
    })
    const decision = resolveRelease(commits, policy, isReleasePath ? { isReleasePath } : {})
    const log = context.logger?.log ?? console.log

    log(`Aronrepo release policy: ${policy.mode} mode, ${releasePaths?.include ? `release paths ${releasePaths.include.join(', ')}` : 'every path releases'}`)
    for (const commit of decision.commits) log(describe(commit))
    log(`Aronrepo release decision: ${decision.release || 'no release'}`)

    return decision.release || null
}

export default { analyzeCommits }
