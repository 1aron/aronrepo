import chalk from 'chalk'
import type { Log } from './log'
import { handle } from './handle'

const pass: Log = (strings, ...slots) => {
    return handle({
        strings, slots,
        message: chalk.bgGreen.bold.white(' ✓ PASS '),
        markEvent: (event) => chalk.bgBlack.green(` ${event} `)
    })
}

export { pass }