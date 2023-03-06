import { program } from 'commander'
import fg from 'fast-glob'
import { execaCommand } from 'execa'
import { build, BuildOptions, Metafile } from 'esbuild'
import pAll from 'p-all'
import log, { chalk } from '@techor/log'
import path from 'upath'
import { readPackage } from '../utils/read-package'
import line, { l } from 'to-line'
import type { PackageJson } from 'pkg-types'
import prettyBytes from 'pretty-bytes'
import normalizePath from 'normalize-path'
import fs from 'fs'
import isEqual from 'lodash.isequal'
import camelCase from 'lodash.camelcase'
import { esbuildOptionNames } from '../utils/esbuild-option-names'

const ext2format = {
    'js': 'iife',
    'cjs': 'cjs',
    'mjs': 'esm',
    'css': 'css'
}

declare type BuildTask = { options?: BuildOptions, metafile?: Metafile, run: () => Promise<any> }

const pkg: PackageJson = readPackage()
const { dependencies, peerDependencies } = pkg
/** Extract external dependencies to prevent bundling */
const externalDependencies = []
dependencies && externalDependencies.push(...Object.keys(dependencies))
peerDependencies && externalDependencies.push(...Object.keys(peerDependencies))

program.command('pack [entryPaths...]')
    .option('-f, --format [formats...]', 'The output format for the generated JavaScript files `iife`, `cjs`, `esm`', ['cjs', 'esm'])
    .option('-w, --watch', 'Rebuild whenever a file changes', false)
    .option('-s, --sourcemap', 'Emit a source map')
    .option('-p, --platform <node,browser,neutral>', 'Platform target', 'browser')
    .option('-t, --type', 'Emit typescript declarations', pkg.types)
    .option('-o, --outdir <dir>', 'The output directory for the build operation', 'dist')
    .option('-e, --external <packages...>', 'External packages to exclude from the build', externalDependencies)
    .option('-ee, --extra-external <packages...>', 'Extra external packages to exclude from the build', [])
    .option('-kn, --keep-names', 'Keep JavaScript function/class names', false)
    .option('--srcdir <dir>', 'The source directory', 'src')
    .option('--mangle-props', 'Pass a regular expression to esbuild to tell esbuild to automatically rename all properties that match this regular expression', '^_')
    .option('--resolve-extensions', 'The resolution algorithm used by node supports implicit file extensions', ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs', '.css', '.json'])
    .option('--no-bundle', 'No inline any imported dependencies into the file itself', true)
    .option('--no-minify', 'The generated code will not be minified instead of pretty-printed')
    .option('--no-clean', 'No clean up the previous output directory before the build starts')
    .action(async function (entries: string[], options, args) {
        if (options.clean && fs.existsSync(options.outdir)) {
            fs.rmSync(options.outdir, { force: true, recursive: true })
            console.log('')
            log.d`Cleaned up the **${options.outdir}** output directory`
        }
        const buildTasks: BuildTask[] = []
        const getFileSrcGlobPattern = (filePath: string, targetExt: string) => {
            return path.changeExt(path.join(options.srcdir, path.relative(options.outdir, filePath)), targetExt)
        }
        const addBuildTask = async (eachEntries: string[], eachOptions: { format: string, ext?: string, platform?: string, outFile?: string }) => {
            const isCSSTask = eachOptions.format === 'css'
            const eachOutext = eachOptions.outFile ? path.extname(eachOptions.outFile) : ''
            const buildOptions = {
                ...options,
                outExtension: isCSSTask
                    ? { '.css': '.css' }
                    : {
                        '.js': eachOutext
                            ? eachOutext
                            : { cjs: '.cjs', esm: '.mjs', iife: '.js' }[eachOptions.format]
                    },
                external: [...options.external, ...options.extraExternal],
                watch: options.watch ? {
                    onRebuild(error, result) {
                        // make esbuild log mute and depend on `tsx`
                    }
                } : false,
                logLevel: 'silent',
                outbase: options.srcdir,
                platform: eachOptions.platform || options.platform,
                metafile: true,
                format: isCSSTask ? undefined : eachOptions.format,
                keepNames: options.keepNames,
                mangleProps: options.mangleProps ? new RegExp(options.mangleProps) : undefined,
                resolveExtensions: options.resolveExtensions
            } as BuildOptions

            // 安全地同步選項給 esbuild
            for (const eachBuildOptionName in buildOptions) {
                if (!esbuildOptionNames.includes(eachBuildOptionName)) {
                    delete buildOptions[eachBuildOptionName]
                }
            }

            buildOptions.entryPoints =
                fg.sync(
                    [...new Set(eachEntries)].map((eachEntry) => normalizePath(eachEntry))
                )
                    .filter((eachEntry: never) =>
                        !buildTasks.find((eachBuildTask) =>
                            (eachBuildTask.options.entryPoints as []).includes(eachEntry)
                            && eachBuildTask.options.format === buildOptions.format
                            && isEqual(eachBuildTask.options.outExtension, buildOptions.outExtension)
                        )
                    )

            const eachBuildTask: BuildTask = {
                options: buildOptions,
                run: async () => {
                    const { metafile } = await build(buildOptions)
                    if (metafile) {
                        console.log('')
                        eachBuildTask.metafile = metafile
                        for (const outputFilePath in metafile.outputs) {
                            const eachOutput = metafile.outputs[outputFilePath]
                            const outputSize = prettyBytes(eachOutput.bytes).replace(/ /g, '')
                            const eachOutputFormat = metafile.outputs[outputFilePath]['format'] = eachOptions.format
                            log`${chalk.dim('│')} $t [${eachOutputFormat}] **${outputFilePath}** ${outputSize} (${Object.keys(eachOutput.inputs).length} inputs)`
                        }
                        log.tree({
                            entries: buildOptions.entryPoints,
                            external: buildOptions.external,
                            outdir: buildOptions.outdir,
                            format: buildOptions.format,
                            platform: buildOptions.platform,
                            [
                                Object.keys(buildOptions)
                                    .filter((x) => buildOptions[x] === true)
                                    .map((x) => chalk.green('✓ ') + x)
                                    .join(', ')
                            ]: null
                        })
                    }
                }
            }

            if (!buildOptions.entryPoints.length) {
                return
            }

            buildTasks.push(eachBuildTask)
        }

        if (pkg.style) {
            addBuildTask([getFileSrcGlobPattern(pkg.main, '.css')], { format: 'css' })
        }
        if (pkg.main && !pkg.main.endsWith('.css')) {
            addBuildTask([getFileSrcGlobPattern(pkg.main, '.{js,ts,jsx,tsx}')], { format: 'cjs', outFile: pkg.main })
        }
        if (pkg.module) {
            addBuildTask([getFileSrcGlobPattern(pkg.module, '.{js,ts,jsx,tsx}')], { format: 'esm', outFile: pkg.module })
        }
        if (pkg.browser) {
            addBuildTask([getFileSrcGlobPattern(pkg.browser, '.{js,ts,jsx,tsx}')], { format: 'iife', platform: 'browser', outFile: pkg.browser })
        }
        if (pkg.bin) {
            if (typeof pkg.bin === 'string') {
                addBuildTask([getFileSrcGlobPattern(pkg.bin, '.{js,ts,jsx,tsx}')], { format: 'cjs', platform: 'node', outFile: pkg.bin })
            } else {
                for (const eachCommandName in pkg.bin) {
                    const eachCommandFile = pkg.bin[eachCommandName]
                    addBuildTask([getFileSrcGlobPattern(eachCommandFile, '.{js,ts,jsx,tsx}')], { format: 'cjs', platform: 'node', outFile: eachCommandFile })
                }
            }
        }
        if (pkg.exports) {
            (function handleExports(eachExports: any, eachParentKey: string, eachOptions?: { format?: string, outFile?: string, platform?: string }) {
                if (typeof eachExports === 'string') {
                    const exportsExt = path.extname(eachExports)
                    addBuildTask([getFileSrcGlobPattern(eachExports, '.{js,ts,jsx,tsx}')], {
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
        if (entries.length) {
            const isCSSEntry = entries.find((eachEntry) => eachEntry.includes('.css'))
            if (isCSSEntry) {
                addBuildTask(entries, { format: 'css' })
            } else {
                options.format.map((eachFormat: string) => addBuildTask(entries, { format: eachFormat }))
            }
        }
        if (!buildTasks.length) {
            options.format.map((eachFormat: string) => addBuildTask([path.join(options.srcdir, 'index.ts')], { format: eachFormat }))
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
            if (eachBuildTask.metafile) {
                Object.keys(eachBuildTask.metafile.outputs)
                    .forEach((outputFilePath) => {
                        const eachOutput = eachBuildTask.metafile.outputs[outputFilePath]
                        const outputSize = prettyBytes(eachOutput.bytes).replace(/ /g, '')
                        const eachOutputFormat = eachOutput['format']
                        log.ok(l`[${eachBuildTask.options.platform}] **${outputFilePath}** ${outputSize} (${eachOutputFormat})`)
                    })
            } else {
                log.ok(l`[${eachBuildTask.options.format}] **${eachBuildTask['outFile']}** (${eachBuildTask.options.format})`)
            }
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