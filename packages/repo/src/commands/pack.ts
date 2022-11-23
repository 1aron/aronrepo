import program from 'commander'
import fg from 'fast-glob'
import fs from 'fs-extra'
import esbuild from 'esbuild'
import parallel from 'run-parallel'

const build = esbuild.buildSync
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
            formats.map((format) => () => {
                build({
                    entryPoints: fg.sync(entry),
                    outExtension: { '.js': { cjs: '.cjs', esm: '.mjs', iife: '.js' }[format] },
                    external: externalDependencies,
                    bundle, minify, watch, outdir, format
                } as esbuild.BuildOptions)
            })
        )
    })

