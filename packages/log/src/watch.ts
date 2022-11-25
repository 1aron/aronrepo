import chalk from 'chalk'
import { handle } from './handle'
import ora from 'ora'

const watch = (strings, ...slots) => {
    ora().start()
    return handle({
        strings, slots,
        showTime: true,
        event: 'watch',
        markEvent: (event) => chalk.dim('[') + chalk.magenta(event) + chalk.dim(']')
    })
}

export { watch }