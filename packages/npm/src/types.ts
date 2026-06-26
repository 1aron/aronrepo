export type PackageManager = 'pnpm' | 'npm'

export interface WorkspaceOptions {
    cwd?: string
}

export interface PackageJson {
    name?: string
    version?: string
    private?: boolean
    workspaces?: string[]
    packageManager?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
    publishConfig?: {
        access?: string
        provenance?: boolean
    }
    [key: string]: unknown
}
