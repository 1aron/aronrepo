import chalk from 'chalk'
import { Log } from 'types'
import { handle } from './handle'

const error: Log = (strings, ...slots) => {
    return handle({
        strings, slots,
        message: chalk.bgRed.bold.white(' ⛌ ERROR '),
        markEvent: (event) => chalk.bgBlack.red(` ${event} `)
    })
}

export { error }