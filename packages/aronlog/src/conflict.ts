import chalk from 'chalk'
import type { Log } from './log'
import { handle } from './handle'

const conflict: Log = (strings, ...slots) => {
    return handle({
        strings, slots,
        message: chalk.bgYellow.bold.white(' ‼ CONFLICT '),
        markEvent: (event) => chalk.bgBlack.yellow(` ${event} `)
    })
}

export { conflict }