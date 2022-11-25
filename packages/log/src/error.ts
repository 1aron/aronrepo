import chalk from 'chalk'
import { Log } from 'types'
import { handle } from './handle'
import treeify from 'object-treeify'
import { parseError } from './utils/parse-error'
import { mark } from './mark'

const error: Log = (strings, ...slots) => {
    if (!Array.isArray(strings)) {
        const { message, stackTree } = parseError(strings)
        const log = handle({
            strings: [] as any, slots,
            message: chalk.bgRed.bold.white(' ⛌ ERROR ') + ' ' + chalk.bold.red(message),
            markEvent: (event) => chalk.bgBlack.red(` ${event} `)
        })
        console.log(treeify(stackTree, {
            spacerNeighbour: chalk.redBright.dim('│  '),
            keyNoNeighbour: chalk.redBright.dim('└─ '),
            keyNeighbour: chalk.redBright.dim('├─ '),
            separator: chalk.redBright.dim(': ')
        }))
        return log
    } else {
        return handle({
            strings, slots,
            message: chalk.bgRed.bold.white(' ⛌ ERROR '),
            markEvent: (event) => chalk.bgBlack.red(` ${event} `)
        })
    }
}

export { error }