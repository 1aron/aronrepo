import chalk from 'chalk'
import type { Log } from './log'
import { handle } from './handle'

const add: Log = (strings, ...slots) => {
    return handle({
        strings, slots,
        header: chalk.green('+'),
        markEvent: (event) => chalk.green(event)
    })
}

export { add }