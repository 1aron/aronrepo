import chalk from 'chalk'
import type { Log } from './log'
import { handle } from './handle'

const success: Log = (strings, ...slots) => {
    return handle({
        strings, slots,
        header: chalk.green('⏺'),
        event: 'Success',
        markEvent: (event) => chalk.bold.green(event),
    })
}

export { success }