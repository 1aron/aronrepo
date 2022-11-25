import chalk from 'chalk'
import { Log } from 'types'
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
