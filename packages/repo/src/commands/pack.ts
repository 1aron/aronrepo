import program from 'commander'
import fg from 'fast-glob'
import fs from 'fs-extra'
import { execSync } from 'child_process'
import esbuild from 'esbuild'
import parallel from 'run-parallel'
import consola from 'consola'

const { dependencies, peerDependencies } = fs.readJSONSync('./package.json')

/** Extract external dependencies to prevent bundling */
const externalDependencies = []
dependencies && externalDependencies.push(...Object.keys(dependencies))
peerDependencies && externalDependencies.push(...Object.keys(peerDependencies))

program.command('pack [entryPaths...]')
    // .allowUnknownOption()
    .option('-f, --format [formats...]', 'The output format for the generated JavaScript files `iife`, `cjs`, `esm`', 'cjs,esm')
    .option('-b, --bundle', 'To bundle a file means to inline any imported dependencies into the file itself', true)
    .option('-m, --minify', 'The generated code will be minified instead of pretty-printed', true)
    .option('-w, --watch', 'Rebuild whenever a file changes', false)
    .option('--outdir <path>', 'The output directory for the build operation', 'dist')
    .action((entry: string[], { format, bundle, minify, watch, outdir }) => {
        const formats = format.split(',')
        if (!entry.length) {
            entry = ['src/index.{js,ts}']
        }
        parallel(
            [
                ...formats.map((format) => async () => {
                    const entryPoints = fg.sync(entry)
                    await esbuild.build({
                        entryPoints,
                        outExtension: { '.js': { cjs: '.cjs', esm: '.mjs', iife: '.js' }[format] },
                        external: externalDependencies,
                        watch: watch ? {
                            onRebuild(error: string, result) {
                                if (error) consola.error(`[${format}] watch build failed`, new Error(error))
                                else consola.success(`[${format}] watch rebuild succeeded`)
                            }
                        } : false,
                        bundle, minify, outdir, format
                    } as esbuild.BuildOptions)
                        .then(result => {
                            consola.start(`[${format}] watching ${reveal(entryPoints, 'entries')}`)
                        })
                }),
                () => execSync('npm exec tsc --emitDeclarationOnly --preserveWatchOutput', {
                    stdio: 'pipe',
                    encoding: 'utf-8'
                })
            ]
        )
    })

function reveal(arr: string[], target) {
    if (arr.length > 2) {
        return `${arr.slice(0, 2).join(', ')}, and ${arr.length - 2} other ${target} ...`
    } else {
        return `${arr.join(', ')} ${target} ...`
    }
}