import { getReleasePolicy, parseCommit, resolveCommitRelease, types, type ReleaseMode } from '@aronrepo/conventional-commits'
import { loadConfig } from '@aronrepo/conventional-commits/node'
import { parserOpts } from '@aronrepo/conventional-changelog-config'

type RuleOutcome = [boolean, string?]

interface RuleCommit {
    raw?: string | null
    header?: string | null
}

export interface NoImplicitBreakingOptions {
    /** Overrides `release.mode` from `aronrepo.config.js`. */
    mode?: ReleaseMode
}

/**
 * Rejects `BREAKING CHANGE:` footers and `Type!:` headers outside `Bump(Major)` in
 * explicit mode, where only the repository owner decides a major release.
 */
export async function noImplicitBreaking(commit: RuleCommit, when: 'always' | 'never' = 'always', options: NoImplicitBreakingOptions = {}): Promise<RuleOutcome> {
    if (when === 'never') return [true]
    const mode = options.mode ?? getReleasePolicy(await loadConfig(process.cwd())).mode
    const decision = resolveCommitRelease(parseCommit(commit.raw ?? commit.header ?? ''), { mode })
    const violation = decision.violations.find(({ rule }) => rule === 'implicit-breaking')
    return violation ? [false, violation.message] : [true]
}

export const plugin = {
    rules: {
        'aronrepo/no-implicit-breaking': noImplicitBreaking
    }
}

const config = {
    parserPreset: {
        parserOpts
    },
    plugins: [plugin],
    rules: {
        'body-leading-blank': [1, 'always'],
        'footer-leading-blank': [1, 'always'],
        'header-case': [2, 'always', 'sentence-case'],
        'scope-case': [2, 'always', 'sentence-case'],
        'subject-case': [2, 'always', ['sentence-case']],
        'subject-empty': [2, 'never'],
        'subject-exclamation-mark': [2, 'never'],
        'subject-full-stop': [2, 'never', '.'],
        'type-case': [2, 'always', ['sentence-case', 'upper-case']],
        'type-empty': [2, 'never'],
        'type-enum': [2, 'always', types],
        'aronrepo/no-implicit-breaking': [2, 'always']
    }
}

export default config
