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
        const formats: string[] = options.format.split(',')
        if (!entries.length) {
            if (formats.includes('cjs') && pkg.main) {
                entries.push(changeFilePath(pkg.main, options.src))
            }
            if (formats.includes('mjs') && pkg.module) {
                entries.push(changeFilePath(pkg.module, options.src))
            }
            if (formats.includes('iife') && pkg.browser) {
                entries.push(changeFilePath(pkg.browser, options.src))
            }
        }
        log.tree({
            ...options,
            entries: entries.length ? entries : ['./src/index.{js,ts}']
        })
        const formatLogText = formats.join(', ').toUpperCase() + (options.types ? ', Type Declarations' : '')
        const loading = log.load(options.watch ? 'watching' : 'building', formatLogText)
        const tasks = formats.map((eachFormat) => async () => {
            const entryPoints = fg.sync(entries)
            loading.clear()
            return await esbuild.build({
                entryPoints,
                outExtension: { '.js': { cjs: '.cjs', esm: '.mjs', iife: '.js' }[eachFormat] },
                external: externalDependencies,
                watch: options.watch ? {
                    onRebuild(error: string, result) {
                        loading.clear()
                        if (error) log.error`${eachFormat} watch build failed ${new Error(error)}`
                        else log.i`${eachFormat} rebuild succeeded`
                    }
                } : false,
                ...options,
                format: eachFormat
            } as esbuild.BuildOptions)
                .then(result => {
                    log.i`${eachFormat} process ${reveal(entryPoints, 'entries')}`
                })
        })
        if (options.types) {
            tasks.push(
                async () => {
                    return await new Promise<void>((resolve) => {
                        exec(`npm exec tsc ${entries.join(' ')} -- --emitDeclarationOnly --preserveWatchOutput --declaration --outDir ${outdir} ${watch ? '--watch' : ''}`,
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