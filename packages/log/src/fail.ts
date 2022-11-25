import chalk from 'chalk'
import { Log } from 'types'
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