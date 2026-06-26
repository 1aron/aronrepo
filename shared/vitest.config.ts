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
        hookTimeout: defaultVitestTestTimeout
    })
}

export default config
