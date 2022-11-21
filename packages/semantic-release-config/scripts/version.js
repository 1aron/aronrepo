const fg = require('fast-glob')
const fs = require('fs-extra')
const path = require('path')
const argv = require('minimist')(process.argv.slice(2))
const { workspaces } = fs.readJSONSync('./package.json')
const { prefix } = argv
const nextVersion = argv._[0]
const workspacePackages = {}
const workspacePackagePaths = workspaces.map((eachWorkspace) => path.join(eachWorkspace, '*package.json'))

// Read package.json by workspaces
fg.sync(workspacePackagePaths)
    .forEach((eachWorkspacePackageJSONPath) => {
        const eachWorkspacePackage = fs.readJSONSync(eachWorkspacePackageJSONPath)
        workspacePackages[eachWorkspacePackageJSONPath] = eachWorkspacePackage
        // Bump to next verion
        eachWorkspacePackage.version = nextVersion
    })

for (const eachWorkspacePackageJSONPath in workspacePackages) {
    const eachWorkspacePackage = workspacePackages[eachWorkspacePackageJSONPath]
    const { dependencies, peerDependencies } = workspacePackages[eachWorkspacePackageJSONPath]
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
        if (dependencyName in workspacePackages) {
            const dependency = dependencies[dependencyName]
            if (dependency === '') {
                dependencies[dependencyName] = prefix + nextVersion
                updated = true
            }
        }
    }
    return updated
}