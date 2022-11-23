import program from 'commander'
import fg from 'fast-glob'
import fs from 'fs-extra'
import path from 'path'

const { workspaces } = fs.readJSONSync('./package.json')

program.command('version <version>')
    .description('Bump to specific version for workspace\'s packages')
    .option('-p, --prefix <symbol>', 'version prefix `^`, `~`, `>`, `>=`, `<`, `<=` ', '^')
    .action((version, { prefix }) => {
        const workspacePackagesOfPath = {}
        const workspacePackagesOfName = {}
        const workspacePackagePaths = workspaces.map((eachWorkspace) => path.join(eachWorkspace, '*package.json'))
        const updateDependencies = (dependencies, title) => {
            let updated = false
            for (const dependencyName in dependencies) {
                if (dependencyName in workspacePackagesOfName) {
                    const dependencyVersion = dependencies[dependencyName]
                    if (dependencyVersion === '') {
                        dependencies[dependencyName] = prefix + version
                        console.log('→', dependencyName, prefix + version, `(${dependencyName} ${title})`)
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
            console.log('Package:', eachWorkspacePackage.name, `(${eachWorkspacePackageJSONPath})`)
            dependencies && updateDependencies(dependencies, 'dependencies')
            peerDependencies && updateDependencies(peerDependencies, 'peerDependencies')
            fs.writeJSONSync(eachWorkspacePackageJSONPath, eachWorkspacePackage)
        }
    })

