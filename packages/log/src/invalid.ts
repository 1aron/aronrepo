import chalk from 'chalk'
import type { Log } from './log'
import { handle } from './handle'

const invalid: Log = (strings, ...slots) => {
    return handle({
        strings, slots,
        header: chalk.red('✗'),
        markEvent: (event) => chalk.red(event)
    })
}

export { invalid }