if (process.env.INIT_CWD === process.cwd()) {
    process.exit()
}

const path = require('path')
const shell = require('shelljs')
const fs = require('fs')
const projectPath = path.resolve(process.cwd(), '../..')

try {
    shell.ln('-sf', path.join(process.cwd(), '.github'), path.join(projectPath, '.github'))
} catch (_) {
    /* empty */
}