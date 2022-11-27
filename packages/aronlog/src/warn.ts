import chalk from 'chalk'
import type { Log } from './log'
import { handle } from './handle'

const warn: Log = (strings, ...slots) => {
    return handle({
        strings, slots,
        header: chalk.yellow('⏺'),
        event: 'Warn',
        markEvent: (event) => chalk.bold.yellow(event),
    })
}

export { warn }
