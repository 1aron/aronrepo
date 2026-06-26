import path from 'node:path'
import fs from 'fs-extra'
import type { WorkspaceOptions } from './types'

export default function readWorkspaces(options: WorkspaceOptions = {}): string[] | undefined {
    const packagePath = path.resolve(options.cwd ?? '', 'package.json')
    if (!fs.pathExistsSync(packagePath)) return undefined
    const pkg = fs.readJsonSync(packagePath) as { workspaces?: string[] | { packages?: string[] } }
    return Array.isArray(pkg.workspaces)
        ? pkg.workspaces
        : pkg.workspaces?.packages
}
