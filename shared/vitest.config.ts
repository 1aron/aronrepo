import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ViteUserConfig } from 'vitest/config'
import { defaultVitestTestTimeout, withCITimeouts } from './vitest-ci-config'

// An empty global git config. Git for Windows cannot read `os.devNull` (`\\.\nul`) as a config file.
const emptyGitConfig = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-gitconfig-')), 'gitconfig')
fs.writeFileSync(emptyGitConfig, '')

const config: ViteUserConfig = {
    test: withCITimeouts({
        globals: true,
        include: [
            'tests/**/*.{test,spec}.?(c|m)[jt]s?(x)',
            'tests/**/test.?(c|m)[jt]s?(x)'
        ],
        exclude: [
            '**/tmp/**'
        ],
        testTimeout: defaultVitestTestTimeout,
        hookTimeout: defaultVitestTestTimeout,
        // Fixture repositories must not pick up the developer's git config, such as signing or hooks.
        env: {
            GIT_CONFIG_GLOBAL: emptyGitConfig,
            GIT_CONFIG_NOSYSTEM: '1'
        }
    })
}

export default config
