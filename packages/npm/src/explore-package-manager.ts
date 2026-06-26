import path from 'node:path'
import fs from 'fs-extra'
import type { PackageManager, WorkspaceOptions } from './types'

export default function explorePackageManager(options: WorkspaceOptions = {}): PackageManager | undefined {
    const cwd = options.cwd ?? process.cwd()
    if (fs.pathExistsSync(path.resolve(cwd, 'pnpm-workspace.yaml'))) return 'pnpm'
    if (fs.pathExistsSync(path.resolve(cwd, 'package.json'))) return 'npm'
    return undefined
}
