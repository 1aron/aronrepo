import { log } from './log'
import { mark } from './mark'
import chalk from 'chalk'

export function handle({ strings, slots, message = '', header, showTime, send = true, event, markEvent }: {
    strings: TemplateStringsArray,
    slots: string[],
    event?: string,
    header?: string,
    message?: string,
    showTime?: boolean,
    send?: boolean,
    markEvent?: (event: string) => string
}) {
    if (showTime) {
        message = chalk.dim(new Date().toLocaleTimeString('en', { hour12: false })) + ' ' + message
    }
    for (let i = 0; i < strings.length; i++) {
        const str = strings[i]
        const slot = slots[i]
        if (i === 0) {
            if (!str && slot && markEvent) {
                message += markEvent(slot)
                continue
            } else if (event && markEvent) {
                message += markEvent(event)
            }
            if (message[message.length - 1] !== ' ') {
                message += ' '
            }
        }
        message += (str + (slot ? mark(slot) : ''))
    }
    message = (header ? header + ' ' : '') + message.trim()
    if (send) {
        console.log(message)
        return log
    } else {
        return message
    }
}
