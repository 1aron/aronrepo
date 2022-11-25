import chalk from 'chalk'
import { Log } from 'types'
import { handle } from './handle'

const conflict: Log = (strings, ...slots) => {
    return handle({
        strings, slots,
        message: chalk.bgYellow.bold.white(' ‼ CONFLICT '),
        markEvent: (event) => chalk.bgBlack.yellow(` ${event} `)
    })
}

export { conflict }