import chalk from 'chalk'
import { Log } from 'types'
import { handle } from './handle'

const invalid: Log = (strings, ...slots) => {
    return handle({
        strings, slots,
        header: chalk.red('✗'),
        markEvent: (event) => chalk.red(event)
    })
}

export { invalid }