import chalk from 'chalk'
import { Log } from 'types'
import { handle } from './handle'

const add: Log = (strings, ...slots) => {
    return handle({
        strings, slots,
        header: chalk.green('+'),
        markEvent: (event) => chalk.green(event)
    })
}

export { add }