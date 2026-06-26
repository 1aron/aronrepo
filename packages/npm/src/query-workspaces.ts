import path from 'node:path'
import fg, { type Options, type Pattern } from 'fast-glob'
import readWorkspaces from './read-workspaces'

function toPosixPath(value: string) {
    return value.split(path.sep).join('/')
}

export default function queryWorkspaces(patterns?: Pattern[], options: Options = {}): string[] {
    const cwd = options.cwd?.toString() ?? process.cwd()
    const usePatterns = patterns?.length ? patterns : readWorkspaces({ cwd })
    if (!usePatterns?.length) return []

    return fg.sync(
        usePatterns.map((workspace) => `${workspace}/package.json`),
        {
            ...options,
            cwd,
            onlyFiles: true,
            ignore: [
                '**/node_modules/**',
                ...(options.ignore ?? [])
            ]
        }
    )
        .map((workspacePackage) => toPosixPath(workspacePackage).replace(/\/package\.json$/, ''))
}
