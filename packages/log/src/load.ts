import chalk from 'chalk'
import { handle } from './handle'
import ora, { Ora } from 'ora'

const load = (strings, ...slots): Ora => {
    const message = handle({
        strings, slots,
        showTime: true,
        send: false,
        markEvent: (event) => chalk.dim('[') + chalk.magenta(event) + chalk.dim(']')
    }) as string
    return ora({
        spinner: {
            'interval': 80,
            'frames': [
                '▰▱▱▱▱▱',
                '▰▰▱▱▱▱',
                '▰▰▰▰▱▱',
                '▰▰▰▰▱▱',
                '▰▰▰▰▰▱',
                '▰▰▰▰▰▰',
                '▱▰▰▰▰▰',
                '▱▱▰▰▰▰',
                '▱▱▱▰▰▰',
                '▱▱▱▱▰▰',
                '▱▱▱▱▱▰'
            ]
        }
    }).start(message)
}

export { load }