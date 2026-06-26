#!/usr/bin/env node

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'fs-extra'
import { consola } from 'consola'
import yargsParser from 'yargs-parser'
import { runVersion } from '@aronrepo/version'

const packagePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../package.json')
const pkg = fs.readJsonSync(packagePath) as { name: string, version?: string }
const [command, ...commandArgs] = process.argv.slice(2)

try {
    switch (command) {
        case 'version':
            await runVersion(commandArgs)
            break
        default: {
            const flags = yargsParser(process.argv.slice(2), {
                alias: {
                    version: 'v',
                    help: 'h'
                },
                boolean: ['version', 'help']
            })
            if (flags.version) {
                consola.info(`${pkg.name} ${pkg.version ?? 'workspace'}`)
            } else {
                consola.info('Usage: aronrepo <version> [...flags]')
            }
        }
    }
} catch (error) {
    consola.error(error)
    process.exitCode = 1
}
