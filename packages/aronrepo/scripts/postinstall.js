if (process.env.INIT_CWD === process.cwd()) {
    process.exit()
}

const path = require('path')
const shell = require('shelljs')
const fs = require('fs')
const projectPath = path.resolve(process.cwd(), '../..')

try {
    fs.mkdirSync(path.join(projectPath, '.github'), { recursive: true })
    shell.cp('-rf', path.join(process.cwd(), '.github', 'workflows'), path.join(projectPath, '.github'))
} catch (_) {
    /* empty */
}