import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: ['src/index.ts', 'src/node.ts', 'src/cli.ts'],
    format: 'esm',
    dts: true,
    clean: true,
    sourcemap: true,
    fixedExtension: false,
    outDir: 'dist'
})
