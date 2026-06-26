import path from 'node:path'
import { consola } from 'consola'
import fs from 'fs-extra'
import yargsParser from 'yargs-parser'
import { explorePackageManager, queryWorkspaces, readPNPMWorkspaces, readWorkspaces, type PackageJson } from '@aronrepo/npm'

export interface VersionOptions {
    cwd?: string
    operator?: '^' | '~' | '>' | '>=' | '<' | '<=' | ''
    workspaces?: string[]
    list?: boolean
}

const dependencyFields = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies'
] as const

export function resolveWorkspaceVersion(current: string, version: string, operator = '^') {
    if (current.startsWith('workspace:')) {
        return `workspace:${current.slice('workspace:'.length) || operator}${version}`
    }
    if (current === '') return `${operator}${version}`
    return `${operator}${version}`
}

function updateDependencies(pkg: PackageJson, workspaceNames: Set<string>, version: string, operator: string) {
    for (const field of dependencyFields) {
        const dependencies = pkg[field]
        if (!dependencies) continue
        for (const dependencyName of Object.keys(dependencies)) {
            if (workspaceNames.has(dependencyName)) {
                dependencies[dependencyName] = resolveWorkspaceVersion(dependencies[dependencyName], version, operator)
            }
        }
    }
}

function resolveWorkspaces(cwd: string, configuredWorkspaces?: string[]) {
    if (configuredWorkspaces?.length) return configuredWorkspaces
    switch (explorePackageManager({ cwd })) {
        case 'pnpm':
            return readPNPMWorkspaces({ cwd }) ?? []
        case 'npm':
            return readWorkspaces({ cwd }) ?? []
        default:
            return []
    }
}

export async function versionWorkspace(version: string, options: VersionOptions = {}) {
    if (!version) throw new Error('A version is required.')

    const cwd = options.cwd ?? process.cwd()
    const workspaces = resolveWorkspaces(cwd, options.workspaces)
    if (!workspaces.length) throw new Error('No workspaces were found.')

    const packageDirs = queryWorkspaces(workspaces, { cwd })
    const packages = new Map<string, PackageJson>()
    const packagesByName = new Map<string, PackageJson>()

    for (const packageDir of packageDirs) {
        const packagePath = path.join(cwd, packageDir, 'package.json')
        const pkg = fs.readJsonSync(packagePath) as PackageJson
        if (!pkg.name) continue
        pkg.version = version
        packages.set(packagePath, pkg)
        packagesByName.set(pkg.name, pkg)
    }

    const workspaceNames = new Set(packagesByName.keys())
    for (const pkg of packages.values()) {
        updateDependencies(pkg, workspaceNames, version, options.operator ?? '^')
    }

    if (!options.list) {
        for (const [packagePath, pkg] of packages) {
            fs.writeJsonSync(packagePath, pkg, { spaces: 4 })
        }
    }

    consola.success(`Bumped ${packages.size} workspace packages to ${version}`)
    return [...packages.values()]
}

export async function runVersion(argv = process.argv.slice(2), options: Pick<VersionOptions, 'cwd'> = {}) {
    const { _, ...flags } = yargsParser(argv, {
        alias: {
            operator: 'o',
            workspaces: 'w',
            list: 'ls'
        },
        array: ['workspaces'],
        boolean: ['list'],
        string: ['operator']
    })

    const [version] = _ as string[]
    return versionWorkspace(version, {
        cwd: options.cwd,
        operator: flags.operator as VersionOptions['operator'],
        workspaces: flags.workspaces as string[] | undefined,
        list: Boolean(flags.list)
    })
}

export default versionWorkspace
