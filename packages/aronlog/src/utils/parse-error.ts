import dedent from 'dedent'
import chalk from 'chalk'

export function parseError(error: any) {
    const { message, stack } = typeof error === 'string' ? new Error(error as any) : error
    const stackTree = {}
    dedent(stack
        .replace(message, '')
        .replace(/^Error: /, '')
    )
        .split('\n')
        .forEach((line) => {
            stackTree[
                line
                    .replace(/\((.+)\)/g, (_, m) => `(${chalk.cyan(m)})`)
                    .replace(/^at /g, m => chalk.dim(m))
            ] = null
        })
    return {
        message: message
            .trim()
            .replace(/Error: /g, ''),
        stackTree
    }
}