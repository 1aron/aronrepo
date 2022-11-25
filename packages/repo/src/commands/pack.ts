import program from 'commander'
import fg from 'fast-glob'
import fs from 'fs-extra'
import { exec } from 'child_process'
import esbuild from 'esbuild'
import pAll from 'p-all'
import log from 'aronlog'
import path from 'path'
import { readPackage } from '../utils/read-package'

const pkg = readPackage()
const { dependencies, peerDependencies } = pkg

console.log('fuck', pkg)

const defaults = {
    formats: [],
    output: path.dirname(pkg.main || pkg.module || pkg.browser || '') || 'dist'
}

console.log(defaults)

pkg.main && defaults.formats.push('cjs')
pkg.module && defaults.formats.push('esm')
pkg.browser && defaults.formats.push('iife')

/** Extract external dependencies to prevent bundling */
const externalDependencies = []
dependencies && externalDependencies.push(...Object.keys(dependencies))
peerDependencies && externalDependencies.push(...Object.keys(peerDependencies))

program.command('pack [entryPaths...]')
    // .allowUnknownOption()
    .option('-f, --format [formats...]', 'The output format for the generated JavaScript files `iife`, `cjs`, `esm`', defaults.formats.join(',') || 'esm,cjs')
    .option('-b, --bundle', 'To bundle a file means to inline any imported dependencies into the file itself', true)
    .option('-m, --minify', 'The generated code will be minified instead of pretty-printed', true)
    .option('-w, --watch', 'Rebuild whenever a file changes', false)
    .option('-t, --type', 'Emit typescript declarations', !!pkg.types)
    .option('-o, --output <path>', 'The output directory for the build operation', defaults.output)
    .action(async (entry: string[], { format, bundle, minify, watch, output, type }) => {
        const formats = format.split(',')
        if (!entry.length) {
            entry = ['src/index.ts']
        }
        const formatLogText = formats.join(', ').toUpperCase() + (type ? ', Type Declarations' : '')
        const loading = log.load`${'building'} ${formatLogText}`
        const tasks = formats.map((format) => async () => {
            const entryPoints = fg.sync(entry)
            loading.clear()
            return await esbuild.build({
                entryPoints,
                outExtension: { '.js': { cjs: '.cjs', esm: '.mjs', iife: '.js' }[format] },
                external: externalDependencies,
                watch: watch ? {
                    onRebuild(error: string, result) {
                        if (error) log.error`${format} watch build failed ${new Error(error)}`
                        else log.watch`${format} rebuild succeeded`
                    }
                } : false,
                outdir: output,
                bundle, minify, format
            } as esbuild.BuildOptions)
                .then(result => {
                    log[watch ? 'w' : 'i']`${format} process ${reveal(entryPoints, 'entries')}`
                })
        })
        if (type) {
            tasks.push(
                async () => {
                    return await new Promise<void>((resolve) => {
                        exec(`npm exec tsc ${entry.join(' ')} -- --emitDeclarationOnly --preserveWatchOutput --declaration --outDir ${output} ${watch ? '--watch' : ''}`,
                            (error, stdout, stderr) => {
                                loading.clear()
                                if (error) {
                                    log.e(error)
                                } else {
                                    log[watch ? 'w' : 'i']`${'type'} declarations emitted`
                                }
                                resolve()
                            }
                        )
                    })
                }
            )
        }
        await pAll(tasks)
        loading.stop()
        log.success`${'Outputed'} ${`.(${output}).`} ${formatLogText}`
    })

function reveal(arr: string[], target) {
    if (arr.length > 2) {
        return `${arr.slice(0, 2).join(', ')}, and ${arr.length - 2} other ${target}`
    } else {
        return `${arr.join(', ')} ${target}`
    }
}