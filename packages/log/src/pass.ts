import chalk from 'chalk'
import { Log } from 'types'
import { handle } from './handle'

const pass: Log = (strings, ...slots) => {
    return handle({
        strings, slots,
        message: chalk.bgGreen.bold.white(' ✓ PASS '),
        markEvent: (event) => chalk.bgBlack.green(` ${event} `)
    })
}

export { pass }