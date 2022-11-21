const fg = require('fast-glob')
const fs = require('fs-extra')
const path = require('path')
const argv = require('minimist')(process.argv.slice(2))
const { workspaces } = fs.readJSONSync('./package.json')
const { prefix } = argv
const nextVersion = argv._[0]
const workspacePackages = {}

fg.sync(workspaces.map((eachWorkspace) => path.join(eachWorkspace, '*package.json')))
    .forEach((packageJSONPath) => {
        const eachWorkspacePackage = fs.readJSONSync(packageJSONPath)
        workspacePackages[eachWorkspacePackage.name] = eachWorkspacePackage
    })

for (const workspacePackageName in workspacePackages) {
    const { dependencies, peerDependencies } = workspacePackages[workspacePackageName]
    if (dependencies) updateDependencies(dependencies)
    if (peerDependencies) updateDependencies(peerDependencies)
}

function updateDependencies(dependencies) {
    for (const dependencyName in dependencies) {
        if (dependencyName in workspacePackages) {
            const dependency = dependencies[dependencyName]
            if (dependency === '') {
                dependencies[dependencyName] = prefix + nextVersion
                console.log(dependencyName, dependencies[dependencyName])
            }
        }
    }
}