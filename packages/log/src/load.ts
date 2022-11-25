import chalk from 'chalk'
import { handle } from './handle'
import ora, { Ora } from 'ora'
import { getTime } from './get-time'

interface LogLoading extends Ora {
    log: (strings: TemplateStringsArray, ...slots) => Ora
}

const load = (strings, ...slots): Ora => {
    const getMessage = (strings, ...slots) => handle({
        strings, slots,
        send: false,
        markEvent: (event) => chalk.dim('[') + chalk.cyan(event) + chalk.dim('…]')
    }) as string
    const message = getMessage(strings, ...slots)
    const loading =
        ora({
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
        }).start(message.trim()) as LogLoading
    loading.log = (strings, ...slots) => {
        const message = getMessage(strings, ...slots)
        loading.text = message
        return loading
    }
    return loading
}

export { load }