import chalk from 'chalk'
import type { Log } from './log'
import { handle } from './handle'

const info: Log = (strings, ...slots) => {
    return handle({
        strings, slots,
        showTime: true,
        markEvent: (event) => chalk.dim('[') + chalk.magenta(event) + chalk.dim(']')
    })
}

export { info }