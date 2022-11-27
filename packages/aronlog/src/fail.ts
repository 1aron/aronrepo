import chalk from 'chalk'
import type { Log } from './log'
import { handle } from './handle'

const fail: Log = (strings, ...slots) => {
    return handle({
        strings, slots,
        header: chalk.red('⏺'),
        event: 'Fail',
        markEvent: (event) => chalk.bold.red(event),
    })
}

export { fail }