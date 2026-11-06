export const packages = [
    '@aronrepo/commitlint-config',
    '@aronrepo/conventional-commits',
    '@aronrepo/conventional-changelog-config',
    '@aronrepo/semantic-release-config',
    '@aronrepo/semantic-release-pnpm'
] as const

export {
    defineConfig,
    type AronrepoConfig,
    type ReleaseMode,
    type ReleasePathsConfig
} from '@aronrepo/conventional-commits'

export { agents, check, doctor, explain, policy, type CommandResult } from './commands'
