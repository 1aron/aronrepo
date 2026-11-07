import os from 'node:os'
import type { ViteUserConfig } from 'vitest/config'
import { defaultVitestTestTimeout, withCITimeouts } from './vitest-ci-config'

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
            GIT_CONFIG_GLOBAL: os.devNull,
            GIT_CONFIG_NOSYSTEM: '1'
        }
    })
}

export default config
