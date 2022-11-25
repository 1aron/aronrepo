import fs from 'fs-extra'

export function readPackage(path = './package.json') {
    return fs.readJSONSync('./package.json', { throws: false }) || {}
}