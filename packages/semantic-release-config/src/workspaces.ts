import path from 'node:path'
import fg from 'fast-glob'
import fs from 'fs-extra'
import { load as loadYaml } from 'js-yaml'

interface PackageJson {
    name?: string
    version?: string
    private?: boolean
    workspaces?: string[] | { packages?: string[] }
    publishConfig?: {
        access?: string
        provenance?: boolean
        [key: string]: unknown
    }
    [key: string]: unknown
}

function toPosixPath(value: string) {
    return value.split(path.sep).join('/')
}

function readPNPMWorkspaces(cwd: string) {
    const workspacePath = path.join(cwd, 'pnpm-workspace.yaml')
    if (!fs.pathExistsSync(workspacePath)) return undefined

    const workspace = loadYaml(fs.readFileSync(workspacePath, 'utf8')) as { packages?: string[] } | undefined
    return workspace?.packages
}

function readNPMWorkspaces(cwd: string) {
    const packagePath = path.join(cwd, 'package.json')
    if (!fs.pathExistsSync(packagePath)) return undefined

    const pkg = fs.readJsonSync(packagePath) as PackageJson
    return Array.isArray(pkg.workspaces)
        ? pkg.workspaces
        : pkg.workspaces?.packages
}

export function readWorkspacePatterns(cwd = process.cwd()) {
    return readPNPMWorkspaces(cwd) ?? readNPMWorkspaces(cwd) ?? []
}

export function queryWorkspaceDirs(patterns: string[], cwd = process.cwd()) {
    if (!patterns.length) return []

    return fg.sync(
        patterns.map((workspace) => `${workspace}/package.json`),
        {
            cwd,
            onlyFiles: true,
            ignore: [
                '**/node_modules/**'
            ]
        }
    )
        .map((workspacePackage) => toPosixPath(workspacePackage).replace(/\/package\.json$/, ''))
}

export function readWorkspacePackage(cwd: string, workspace: string) {
    return fs.readJsonSync(path.join(cwd, workspace, 'package.json')) as PackageJson
}
