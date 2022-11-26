import path from 'path'

export function changeFilePath(filePath: string, targetDir: string, targetExt = '.{js,ts}') {
    const parsedFilePath = path.parse(filePath)
    return path.join(targetDir, parsedFilePath.name + targetExt)
}