import { program } from 'commander'
import fg from 'fast-glob'
import { execaCommand } from 'execa'
import { build, BuildOptions } from 'esbuild'
import pAll from 'p-all'
import log from '@techor/log'
import path from 'path'
import { readPackage } from '../utils/read-package'
import { changeFilePath } from '../utils/change-file-path'
import literal from '@master/literal'
import type { PackageJson } from 'pkg-types'
import prettyBytes from 'pretty-bytes'
import normalizePath from 'normalize-path'

program.command('pack [entryPaths...]')
    .allowUnknownOption()
    .option('-f, --format [formats...]', 'The output format for the generated JavaScript files `iife`, `cjs`, `esm`')
    .option('-b, --bundle', 'To bundle a file means to inline any imported dependencies into the file itself')
    .option('-m, --minify', 'The generated code will be minified instead of pretty-printed')
    .option('-w, --watch', 'Rebuild whenever a file changes')
    .option('-s, --sourcemap', 'Emit a source map')
    .option('-p, --platform <node,browser,neutral>', 'Platform target')
    .option('-t, --type', 'Emit typescript declarations')
    .option('-o, --outdir <dir>', 'The output directory for the build operation')
    .option('--srcdir <dir>', 'The source directory')
    .action(async function (entries: string[]) {
        const pkg: PackageJson = readPackage()
        const { dependencies, peerDependencies } = pkg
        const pkgEntry = pkg.main || pkg.module || pkg.browser
        /** Extract external dependencies to prevent bundling */
        const externalDependencies = []
        dependencies && externalDependencies.push(...Object.keys(dependencies))
        peerDependencies && externalDependencies.push(...Object.keys(peerDependencies))
        const options = Object.assign({
            format: '',
            watch: false,
            minify: true,
            bundle: true,
            type: !!pkg.types,
            srcdir: 'src',
            outdir: path.dirname(pkgEntry) || 'dist',
            externals: externalDependencies
        }, this.opts())
        const tasks = []
        const event = options.watch ? 'watching' : 'building'
        const addBuildTask = async (eachEntries: string[], eachFormat: string, eachExt?: string) => {
            const eachEntryPoints = fg.sync(
                [...new Set(eachEntries)].map((eachEntry) => normalizePath(eachEntry))
            )
            const isCSSTask = eachFormat === 'css'
            if (!eachEntryPoints.length) {
                log.e`[${eachFormat}] Cannot find any entry file specified **${eachEntries}**`
                process.exit()
            }
            tasks.push(
                async () => {
                    const { metafile } = await build({
                        entryPoints: eachEntryPoints,
                        outExtension: isCSSTask
                            ? { '.css': '.css' }
                            : {
                                '.js': eachExt
                                    ? eachExt
                                    : { cjs: '.cjs', esm: '.mjs', iife: '.js' }[eachFormat]
                            },
                        external: externalDependencies,
                        watch: options.watch ? {
                            onRebuild(error, result) {
                                // make esbuild log mute and depend on `tsx`
                            }
                        } : false,
                        logLevel: 'silent',
                        outdir: options.outdir,
                        bundle: options.bundle,
                        minify: options.minify,
                        sourcemap: options.sourcemap,
                        platform: options.platform,
                        metafile: true,
                        format: isCSSTask ? undefined : eachFormat
                    } as BuildOptions)
                    if (metafile) {
                        for (const outputFilePath in metafile.outputs) {
                            const eachOutput = metafile.outputs[outputFilePath]
                            log.i`[${eachFormat}] **${outputFilePath}** ++${prettyBytes(eachOutput.bytes)}++ ..${Object.keys(eachOutput.inputs)?.length}.. ..inputs..`
                        }
                    }
                }
            )
        }
        let formats: string[] = []
        if (entries.length) {
            const isCSSEntry = entries.find((eachEntry) => eachEntry.includes('.css'))
            if (isCSSEntry) {
                addBuildTask(entries, 'css')
                formats.push('css')
            } else {
                formats = (options.format || 'cjs,esm').split(',')
                formats.map((eachFormat: string) => addBuildTask(entries, eachFormat))
            }
        } else {
            if (pkg.style) {
                addBuildTask([changeFilePath(pkg.main, options.srcdir, '.css')], 'css')
                formats.push('css')
            }
            if (pkg.main && !pkg.main.endsWith('.css')) {
                addBuildTask([changeFilePath(pkg.main, options.srcdir, '.{tsx,ts}')], 'cjs', path.extname(pkg.main))
                formats.push('cjs')
            }
            if (pkg.module) {
                addBuildTask([changeFilePath(pkg.module, options.srcdir, '.{tsx,ts}')], 'esm', path.extname(pkg.module))
                formats.push('esm')
            }
            if (pkg.browser) {
                addBuildTask([changeFilePath(pkg.browser, options.srcdir, '.{tsx,ts}')], 'iife', path.extname(pkg.browser))
                formats.push('iife')
            }
            if (!tasks.length) {
                formats = (options.format || 'cjs,esm').split(',')
                formats.map((eachFormat: string) => addBuildTask([path.join(options.srcdir, 'index.ts')], eachFormat))
            }
        }
        options.format = formats.join(',')
        if (options.type) {
            tasks.push(
                () => new Promise<void>((resolve) => {
                    if (options.watch) {
                        log.i`[type] type declarations`
                    }
                    execaCommand(literal`
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
                        .finally(() => {
                            log.i`[type] type declarations`
                            resolve()
                        })
                })
            )
        }
        if (Object.keys(pkg).length) {
            log`???? extract and merge options from +${pkg.name}+ **package.json**`
        }
        log.tree(options)
        const formatLogText = formats.join(', ').toUpperCase() + (options.type ? ', Type Declarations' : '')
        log.info`[${event}] ${options.watch ? ' ' : formatLogText}`
        await pAll(tasks)
        if (!options.watch) {
            log.success`${formatLogText} ..${options.outdir}..`
            console.log('')
        }
    })