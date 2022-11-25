import chalk from 'chalk'
import { handle } from './handle'
import ora, { Ora } from 'ora'
import { getTime } from './get-time'

const load = (strings, ...slots): Ora => {
    const message = handle({
        strings, slots,
        send: false,
        markEvent: (event) => chalk.dim('[') + chalk.cyan(event ) + chalk.dim('…]')
    }) as string
    return ora({
        spinner: {
            'interval': 80,
            'frames': [
                '▰▱▱▱▱▱▱▱',
                '▰▰▱▱▱▱▱▱',
                '▰▰▰▱▱▱▱▱',
                '▰▰▰▰▱▱▱▱',
                '▰▰▰▰▰▱▱▱',
                '▰▰▰▰▰▰▱▱',
                '▰▰▰▰▰▰▰▱',
                '▰▰▰▰▰▰▰▰',
                '▱▰▰▰▰▰▰▰',
                '▱▱▰▰▰▰▰▰',
                '▱▱▱▰▰▰▰▰',
                '▱▱▱▱▰▰▰▰',
                '▱▱▱▱▱▰▰▰',
                '▱▱▱▱▱▱▰▰',
                '▱▱▱▱▱▱▱▰',
            ]
        }
    }).start(message.trim())
}

export { load }