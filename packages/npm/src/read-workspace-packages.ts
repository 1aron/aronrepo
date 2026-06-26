import path from 'node:path'
import fs from 'fs-extra'
import type { Options, Pattern } from 'fast-glob'
import queryWorkspaces from './query-workspaces'
import type { PackageJson } from './types'

export default function readWorkspacePackages(patterns?: Pattern[], options: Options = {}): PackageJson[] {
    const cwd = options.cwd?.toString() ?? process.cwd()
    return queryWorkspaces(patterns, options)
        .map((workspace) => fs.readJsonSync(path.join(cwd, workspace, 'package.json')) as PackageJson)
}
