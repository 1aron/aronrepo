import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

function run(command: string) {
    execSync(command, { cwd: __dirname, stdio: 'inherit' })
}

function exist(filePaths: string[]) {
    filePaths.forEach((eachFilePath) => {
        expect(fs.existsSync(path.join(__dirname, eachFilePath))).toBeTruthy()
    })
}

test('extract css entries from `package.json`', () => {
    run('aron pack')
    exist(['dist/index.css'])
})