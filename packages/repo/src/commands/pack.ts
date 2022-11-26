import program from 'commander'
import fg from 'fast-glob'
import { exec } from 'child_process'
import esbuild from 'esbuild'
import pAll from 'p-all'
import log from 'aronlog'
import path from 'path'
import { readPackage } from '../utils/read-package'
import { markJoin } from 'src/utils/mark-join'
import { changeFilePath } from 'src/utils/change-file-path'

const pkg = readPackage()
const { dependencies, peerDependencies } = pkg
const pkgEntry = pkg.main || pkg.module || pkg.browser
// TODO 對應 main, module, browser 來輸出檔案

/** Extract external dependencies to prevent bundling */
const externalDependencies = []
dependencies && externalDependencies.push(...Object.keys(dependencies))
peerDependencies && externalDependencies.push(...Object.keys(peerDependencies))

program.command('pack [entryPaths...]')
    // .allowUnknownOption()
    .option('-f, --format [formats...]', 'The output format for the generated JavaScript files `iife`, `cjs`, `esm`', '')
    .option('-b, --bundle', 'To bundle a file means to inline any imported dependencies into the file itself', true)
    .option('-m, --minify', 'The generated code will be minified instead of pretty-printed', true)
    .option('-w, --watch', 'Rebuild whenever a file changes', false)
    .option('-t, --types', 'Emit typescript declarations', !!pkg.types)
    .option('-o, --outdir <dir>', 'The output directory for the build operation', pkgEntry ? path.dirname(pkgEntry) : 'dist')
    .option('-o, --srcdir <dir>', 'The source directory', 'src')
    .action(async function (entries: string[]) {
        if (Object.keys(pkg).length) {
            log`📦 extract and merge options from ${`+${pkg.name}+`}'s ${'*package.json*'}`
        }
        const options = this.opts()
        const tasks = []
        const addBuildTask = async (eachEntries: string[], eachFormat: string) => {
            const eachEntryPoints = fg.sync([...new Set(eachEntries)])
            if (!eachEntryPoints.length) {
                log.e`${eachFormat} Cannot find any entry file specified ${markJoin(eachEntries)}`
                return
            }
            tasks.push(
                async () => {
                    loading.clear()
                    await esbuild.build({
                        entryPoints: eachEntryPoints,
                        outExtension: { '.js': { cjs: '.cjs', esm: '.mjs', iife: '.js' }[eachFormat] },
                        external: externalDependencies,
                        watch: options.watch ? {
                            onRebuild(error: string, result) {
                                loading.clear()
                                if (error) log.error`${eachFormat} watch build failed ${new Error(error)}`
                                else log.i`${eachFormat} rebuild succeeded`
                            }
                        } : false,
                        outdir: options.outdir,
                        bundle: options.bundle,
                        minify: options.minify,
                        format: eachFormat
                    } as esbuild.BuildOptions)
                        .then(result => {
                            log.i`${eachFormat} process ${reveal(eachEntryPoints, 'entries')}`
                        })
                }
            )
        }
        let formats: string[] = []
        if (entries.length) {
            formats = (options.format || 'cjs,esm').split(',')
            formats.map((eachFormat: string) => addBuildTask(entries, eachFormat))
        } else {
            if (pkg.main) {
                addBuildTask([changeFilePath(pkg.main, options.srcdir, '.ts')], 'cjs')
                formats.push('cjs')
            }
            if (pkg.module) {
                addBuildTask([changeFilePath(pkg.module, options.srcdir, '.ts')], 'esm')
                formats.push('esm')
            }
            if (pkg.browser) {
                addBuildTask([changeFilePath(pkg.browser, options.srcdir, '.ts')], 'iife')
                formats.push('iife')
            }
            if (!tasks.length) {
                formats = (options.format || 'cjs,esm').split(',')
                formats.map((eachFormat: string) => addBuildTask([path.join(options.srcdir, 'index.ts')], eachFormat))
            }
        }
        options.format = formats.join(',')
        const formatLogText = formats.join(', ').toUpperCase() + (options.types ? ', Type Declarations' : '')
        if (options.types) {
            tasks.push(
                async () => {
                    return await new Promise<void>((resolve) => {
                        exec(`npm exec tsc ${entries.join(' ')} -- --emitDeclarationOnly --preserveWatchOutput --declaration --outDir ${options.outdir} ${options.watch ? '--watch' : ''}`,
                            (error, stdout, stderr) => {
                                loading.clear()
                                if (error) {
                                    log.e(error)
                                } else {
                                    log.i`${'types'} declarations emitted`
                                }
                                resolve()
                            }
                        )
                    })
                }
            )
        }
        log.tree({
            ...options
        })
        const loading = log.load(options.watch ? 'watching' : 'building', formatLogText)
        await pAll(tasks)
        loading.stop()
        log.success`${'Outputed'} ${`.(${options.outdir}).`} ${formatLogText}`
    })

function reveal(arr: string[], target) {
    if (arr.length > 2) {
        return `${markJoin(arr.slice(0, 2))}, and ${arr.length - 2} other ${target}`
    } else {
        return `${markJoin(arr)} ${target}`
    }
}