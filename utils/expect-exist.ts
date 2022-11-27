import fs from 'fs'
import path from 'path'
const parentModuleDir = path.dirname(require.main.filename)

export function expectExist(filePaths: string[]) {
    filePaths.forEach((eachFilePath) => {
        expect(fs.existsSync(path.join(parentModuleDir, eachFilePath))).toBeTruthy()
    })
}