const fg = require('fast-glob')
const fs = require('fs-extra')
const path = require('path')
const argv = require('minimist')(process.argv.slice(2))
const { workspaces } = fs.readJSONSync('./package.json')
const { prefix } = argv
const nextVersion = argv._[0]
const workspacePackagesOfPath = {}
const workspacePackagesOfName = {}
const workspacePackagePaths = workspaces.map((eachWorkspace) => path.join(eachWorkspace, '*package.json'))

// Read package.json by workspaces
fg.sync(workspacePackagePaths)
    .forEach((eachWorkspacePackageJSONPath) => {
        const eachWorkspacePackage = fs.readJSONSync(eachWorkspacePackageJSONPath)
        workspacePackagesOfPath[eachWorkspacePackageJSONPath] = eachWorkspacePackage
        workspacePackagesOfName[eachWorkspacePackage.name] = eachWorkspacePackage
        // Bump to next verion
        eachWorkspacePackage.version = nextVersion
    })

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

function updateDependencies(dependencies) {
    let updated = false
    for (const dependencyName in dependencies) {
        if (dependencyName in workspacePackagesOfName) {
            const dependencyVersion = dependencies[dependencyName]
            if (dependencyVersion === '') {
                dependencies[dependencyName] = prefix + nextVersion
                updated = true

            }
        }
    }
    return updated
}