import chalk from 'chalk'
import { handle } from './handle'
import { Log } from 'types'

const watch: Log = (strings, ...slots) => {
    return handle({
        strings, slots,
        showTime: true,
        event: 'watch',
        markEvent: (event) =>
            chalk.dim('[') + chalk.magenta(event) + chalk.dim(']'),
        transform: (message) => message + chalk.cyan(' …')
    })
}

export { watch }