import chalk from 'chalk'
import { Log } from 'types'
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