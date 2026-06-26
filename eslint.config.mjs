import config from './packages/eslint-config/dist/index.js'

export default [
    ...config,
    {
        ignores: [
            '**/dist/**',
            '**/node_modules/**',
            'pnpm-lock.yaml'
        ]
    }
]
