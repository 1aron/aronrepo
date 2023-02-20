import { program } from 'commander'
import fg from 'fast-glob'
import { execaCommand } from 'execa'
import { build, BuildOptions } from 'esbuild'
import pAll from 'p-all'
import log from '@techor/log'
import path from 'upath'
import { readPackage } from '../utils/read-package'
import line, { l } from 'to-line'
import type { PackageJson } from 'pkg-types'
import prettyBytes from 'pretty-bytes'
import normalizePath from 'normalize-path'

const ext2format = {
    'js': 'iife',
    'cjs': 'cjs',
    'mjs': 'esm',
    'css': 'css'
}

declare type BuildTask = { options?: BuildOptions, outFile?: string, outputSize?: string, run: () => Promise<any> }

const pkg: PackageJson = readPackage()
const { dependencies, peerDependencies } = pkg
/** Extract external dependencies to prevent bundling */
const externalDependencies = []
dependencies && externalDependencies.push(...Object.keys(dependencies))
peerDependencies && externalDependencies.push(...Object.keys(peerDependencies))

program.command('pack [entryPaths...]')
    .allowUnknownOption()
    .option('-f, --format [formats...]', 'The output format for the generated JavaScript files `iife`, `cjs`, `esm`')
    .option('-b, --bundle', 'To bundle a file means to inline any imported dependencies into the file itself', true)
    .option('-m, --minify', 'The generated code will be minified instead of pretty-printed', true)
    .option('-w, --watch', 'Rebuild whenever a file changes', false)
    .option('-s, --sourcemap', 'Emit a source map')
    .option('-p, --platform <node,browser,neutral>', 'Platform target', 'node')
    .option('-t, --type', 'Emit typescript declarations', pkg.types)
    .option('-o, --outdir <dir>', 'The output directory for the build operation', 'dist')
    .option('-e, --external <packages...>', 'External packages to exclude from the build', externalDependencies)
    .option('--srcdir <dir>', 'The source directory', 'src')
    .action(async function (entries: string[]) {
        const options = this.opts()
        const buildTasks: BuildTask[] = []
        const getFileSrcGlobPattern = (filePath: string, targetExt: string) => {
            return path.changeExt(path.join(options.srcdir, path.relative(options.outdir, filePath)), targetExt)
        }
        const addBuildTask = async (eachEntries: string[], eachOptions: { format: string, ext?: string, platform?: string, outFile?: string }) => {
            if (buildTasks.find((eachBuildTask) => eachBuildTask.outFile === eachOptions.outFile)) {
                return
            }
            const isCSSTask = eachOptions.format === 'css'
            const eachOutext = eachOptions.outFile ? path.extname(eachOptions.outFile) : ''
            const buildOptions = {
                outExtension: isCSSTask
                    ? { '.css': '.css' }
                    : { '.js': eachOutext ? eachOutext : { cjs: '.cjs', esm: '.mjs', iife: '.js' }[eachOptions.format] },
                external: options.external,
                watch: options.watch ? {
                    onRebuild(error, result) {
                        // make esbuild log mute and depend on `tsx`
                    }
                } : false,
                logLevel: 'silent',
                outdir: options.outdir,
                outbase: options.srcdir,
                bundle: options.bundle,
                minify: options.minify,
                sourcemap: options.sourcemap,
                platform: eachOptions.platform || options.platform,
                metafile: true,
                format: isCSSTask ? undefined : eachOptions.format
            } as BuildOptions

            buildOptions.entryPoints = fg.sync(
                [...new Set(eachEntries)].map((eachEntry) => normalizePath(eachEntry))
            )

            if (!buildOptions.entryPoints.length) {
                log.e`[${eachOptions.format}] Cannot find any entry file specified **${eachEntries}**`
                return
            }

            const eachBuildTask: BuildTask = {
                outFile: eachOptions.outFile,
                options: buildOptions,
                run: async () => {
                    const { metafile } = await build(buildOptions)
                    if (metafile) {
                        for (const outputFilePath in metafile.outputs) {
                            const eachOutput = metafile.outputs[outputFilePath]
                            console.log('')
                            eachBuildTask.outFile = outputFilePath
                            eachBuildTask.outputSize = prettyBytes(eachOutput.bytes).replace(/ /g, '')
                            log.i`[${eachOptions.format}] **${outputFilePath}** ${eachBuildTask.outputSize} (${Object.keys(eachOutput.inputs).length} inputs)`
                        }
                        log.tree({
                            entries: buildOptions.entryPoints,
                            external: buildOptions.external,
                            outdir: buildOptions.outdir,
                            bundle: buildOptions.bundle,
                            minify: buildOptions.minify,
                            format: buildOptions.format,
                            platform: buildOptions.platform
                        })
                    }
                }
            }

            buildTasks.push(eachBuildTask)
        }
        if (entries.length) {
            const isCSSEntry = entries.find((eachEntry) => eachEntry.includes('.css'))
            if (isCSSEntry) {
                addBuildTask(entries, { format: 'css' })
            } else {
                (options.format || 'cjs,esm').split(',').map((eachFormat: string) => addBuildTask(entries, { format: eachFormat }))
            }
        } else {
            if (pkg.style) {
                addBuildTask([getFileSrcGlobPattern(pkg.main, '.css')], { format: 'css' })
            }
            if (pkg.main && !pkg.main.endsWith('.css')) {
                addBuildTask([getFileSrcGlobPattern(pkg.main, '.{tsx,ts,js}')], { format: 'cjs', outFile: pkg.main })
            }
            if (pkg.module) {
                addBuildTask([getFileSrcGlobPattern(pkg.module, '.{tsx,ts,js}')], { format: 'esm', outFile: pkg.module })
            }
            if (pkg.browser) {
                addBuildTask([getFileSrcGlobPattern(pkg.browser, '.{tsx,ts,js}')], { format: 'iife', platform: 'browser', outFile: pkg.browser })
            }
            if (pkg.bin) {
                if (typeof pkg.bin === 'string') {
                    addBuildTask([getFileSrcGlobPattern(pkg.bin, '.{tsx,ts,js}')], { format: 'cjs', platform: 'node', outFile: pkg.bin })
                } else {
                    for (const eachCommandName in pkg.bin) {
                        const eachCommandFile = pkg.bin[eachCommandName]
                        addBuildTask([getFileSrcGlobPattern(eachCommandFile, '.{tsx,ts,js}')], { format: 'cjs', platform: 'node', outFile: eachCommandFile })
                    }
                }
            }
            if (pkg.exports) {
                (function handleExports(eachExports: any, eachParentKey: string, eachOptions?: { format?: string, outFile?: string, platform?: string }) {
                    if (typeof eachExports === 'string') {
                        const exportsExt = path.extname(eachExports)
                        addBuildTask([getFileSrcGlobPattern(eachExports, '.{tsx,ts,js}')], {
                            format: eachOptions.format || ext2format[exportsExt],
                            outFile: eachOptions.outFile || eachExports,
                            platform: eachOptions.platform
                        })
                    } else {
                        for (const eachExportKey in eachExports) {
                            const eachUnknowExports = eachExports[eachExportKey]
                            let eachFormat: string
                            let eachPlatform: string
                            switch (eachParentKey) {
                                case 'node':
                                    eachPlatform = 'node'
                                    break
                                case 'browser':
                                    eachPlatform = 'browser'
                                    break
                                case 'require':
                                    eachFormat = 'cjs'
                                    break
                                case 'import':
                                    eachFormat = 'esm'
                                    break
                            }
                            if (eachExportKey.startsWith('.')) {
                                handleExports(eachUnknowExports, eachExportKey)
                            } else {
                                switch (eachExportKey) {
                                    case 'node':
                                        handleExports(eachUnknowExports, eachExportKey, { platform: 'node', format: eachFormat })
                                        break
                                    case 'browser':
                                        handleExports(eachUnknowExports, eachExportKey, { platform: 'browser', format: eachFormat })
                                        break
                                    case 'default':
                                        handleExports(eachUnknowExports, eachExportKey, { platform: eachPlatform, format: eachFormat })
                                        break
                                    case 'require':
                                        handleExports(eachUnknowExports, eachExportKey, { platform: eachPlatform, format: 'cjs' })
                                        break
                                    case 'import':
                                        handleExports(eachUnknowExports, eachExportKey, { platform: eachPlatform, format: 'esm' })
                                        break
                                }
                            }
                        }
                    }
                })(pkg.exports, '')
            }
            if (!buildTasks.length) {
                (options.format || 'cjs,esm').split(',').map((eachFormat: string) => addBuildTask([path.join(options.srcdir, 'index.ts')], { format: eachFormat }))
            }
        }
        let typeBuildTask: any
        if (options.type) {
            typeBuildTask = {
                outFile: 'declarations',
                options: {
                    platform: 'type',
                    format: 'dts'
                },
                run: () => new Promise<void>((resolve) => {
                    const runTsc = () => execaCommand(line`
                        npx tsc --emitDeclarationOnly --preserveWatchOutput --declaration
                        --outDir ${options.outdir}
                        ${options.watch && '--watch'}
                    `, {
                        stdio: 'inherit',
                        stripFinalNewline: false
                    })
                        .catch((reason) => {
                            process.exit()
                        })
                        .finally(resolve)
                    if (options.watch) {
                        setTimeout(runTsc, 100)
                    } else {
                        runTsc()
                    }
                })
            } as any
            if (!options.watch) {
                buildTasks.push(typeBuildTask)
            }
        }

        await pAll(buildTasks.map(({ run }) => run))

        console.log('')
        if (options.watch && typeBuildTask) {
            buildTasks.push(typeBuildTask)
        }
        for (const eachBuildTask of buildTasks) {
            log.ok(l`[${eachBuildTask.options.platform}] **${eachBuildTask.outFile}** ${eachBuildTask.outputSize} (${eachBuildTask.options.format})`)
        }
        console.log('')
        if (options.watch) {
            log`Start watching ${buildTasks.length} build tasks`
        } else {
            log.success`${buildTasks.length} build tasks`
        }
        console.log('')

        if (options.watch && typeBuildTask) {
            await typeBuildTask.run()
        }
    })