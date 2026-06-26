import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import type { WorkspaceOptions } from './types'

export default function readPNPMWorkspaces(options: WorkspaceOptions = {}): string[] | undefined {
    const workspacePath = path.resolve(options.cwd ?? '', 'pnpm-workspace.yaml')
    if (!fs.pathExistsSync(workspacePath)) return undefined
    const workspace = yaml.load(fs.readFileSync(workspacePath, 'utf8')) as { packages?: string[] } | undefined
    return workspace?.packages
}
