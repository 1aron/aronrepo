const program = require('commander')
const fg = require('fast-glob')
const fs = require('fs-extra')
const path = require('path')
const { workspaces } = fs.readJSONSync('./package.json')

program.command('version <version>')
    .description('Bump to specific version for workspace\'s packages')
    .option('-p, --prefix <symbol>', 'version prefix `^`, `~`, `>`, `>=`, `<`, `<=` ', '^')
    .action((version, { prefix }) => {
        const workspacePackagesOfPath = {}
        const workspacePackagesOfName = {}
        const workspacePackagePaths = workspaces.map((eachWorkspace) => path.join(eachWorkspace, '*package.json'))
        const updateDependencies = (dependencies) => {
            let updated = false
            for (const dependencyName in dependencies) {
                if (dependencyName in workspacePackagesOfName) {
                    const dependencyVersion = dependencies[dependencyName]
                    if (dependencyVersion === '') {
                        dependencies[dependencyName] = prefix + version
                        updated = true

                    }
                }
            }
            return updated
        }

        // Read package.json by workspaces
        for (const eachWorkspacePackageJSONPath of fg.sync(workspacePackagePaths)) {
            const eachWorkspacePackage = fs.readJSONSync(eachWorkspacePackageJSONPath)
            // Prevent version bumps of private package
            if (!eachWorkspacePackage.private) {
                workspacePackagesOfPath[eachWorkspacePackageJSONPath] = eachWorkspacePackage
                workspacePackagesOfName[eachWorkspacePackage.name] = eachWorkspacePackage
                // Bump to next verion
                eachWorkspacePackage.version = version
            }
        }

        for (const eachWorkspacePackageJSONPath in workspacePackagesOfPath) {
            const eachWorkspacePackage = workspacePackagesOfPath[eachWorkspacePackageJSONPath]
            const { dependencies, peerDependencies } = workspacePackagesOfPath[eachWorkspacePackageJSONPath]
            if (
                dependencies && updateDependencies(dependencies)
                || (peerDependencies) && updateDependencies(peerDependencies)
            ) {
                fs.writeJSONSync(eachWorkspacePackageJSONPath, eachWorkspacePackage)
            }
        }
    })

