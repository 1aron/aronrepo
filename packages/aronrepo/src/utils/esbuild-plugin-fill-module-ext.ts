import { Plugin } from 'esbuild'
import fs from 'fs'
import fg from 'fast-glob'
import path from 'upath'
import log from '@techor/log'

export function createFillModuleExtPlugin(outext = '.js', outdir = 'src'): Plugin {
    const resolvedOutdir = path.resolve(outdir)
    return {
        name: 'fill-module-ext',
        setup(build) {
            build.onLoad({ filter: /\.ts$/ }, async (args) => {
                const content = await fs.promises.readFile(args.path, { encoding: 'utf8' })
                return {
                    contents: content
                        .replace(/((?:(?:import|export)(?:.*from | ))|(?:(?:import))\()'((\.(?:\.)?\/.*)|\.)'/gmi,
                            (...matches) => {
                                const modulePath: string = matches[2]
                                const parsedModulePath = path.parse(modulePath)
                                if (parsedModulePath.ext) {
                                    return matches[1]
                                }
                                let cd = '../'
                                if (parsedModulePath.dir.startsWith('../')) {
                                    cd = '../../'
                                }
                                const foundModuleSourcePath = fg.sync([
                                    path.join(args.path, parsedModulePath.dir, cd, parsedModulePath.name) + '.{ts,js,mjs,jsx,tsx}',
                                    path.join(args.path, parsedModulePath.dir, cd, parsedModulePath.name, 'index.{ts,js,mjs,jsx,tsx}')
                                ])[0]
                                if (!foundModuleSourcePath) {
                                    return matches[0]
                                }
                                let targetModulePath = path.relative(resolvedOutdir, path.changeExt(foundModuleSourcePath, outext))
                                if (parsedModulePath.dir === '.' || parsedModulePath.dir === '') {
                                    targetModulePath = './' + targetModulePath
                                } else {
                                    targetModulePath = path.join(parsedModulePath.dir, targetModulePath)
                                }
                                return `${matches[1]}'${targetModulePath}'`
                            }),
                    loader: 'ts',
                }
            })
        }
    }
}