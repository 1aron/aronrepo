import fs from 'fs'
import path from 'path'
const parentModuleDir = path.dirname(require.main.filename)

export function expectFileIncludes(filePath: string, includes: string[]) {
    const content = fs.readFileSync(path.join(parentModuleDir, filePath)).toString()
    includes.map((include)=> {
        expect(content).toContain(include)
    })
}