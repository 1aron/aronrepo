if (process.env.INIT_CWD === process.cwd()) {
    process.exit()
}

const path = require('path')
const shell = require('shelljs')
const fs = require('fs')
const projectPath = path.resolve(process.cwd(), '../..')

try {
    shell.ls(path.join(process.cwd(), '.github')).forEach(dirName => {
        shell.mkdir('-p', path.join(projectPath, '.github', dirName))
        shell.ls(path.join(process.cwd(), '.github', dirName, '*.{md,yml}')).forEach(filePath => {
            shell.ln('-sf', filePath, path.join(projectPath, '.github', dirName, path.basename(filePath)))
        })
    })
} catch (_) {
    /* empty */
}