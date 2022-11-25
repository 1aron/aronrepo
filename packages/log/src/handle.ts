import { log } from './log'
import { mark } from './mark'
import chalk from 'chalk'
import { Log } from 'types'
import { getTime } from './get-time'

export function handle(
    { strings, slots, message = '', header, showTime, send = true, event, transform, markEvent }: {
        strings: TemplateStringsArray,
        slots: string[],
        event?: string,
        header?: string,
        message?: string,
        showTime?: boolean,
        send?: boolean,
        transform?: (message: string) => string
        markEvent?: (event: string) => string
    }
): string | Log {
    if (showTime) {
        message = getTime() + ' ' + message
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
    if (transform) {
        message = transform(message)
    }
    if (send) {
        console.log(message)
        return log
    } else {
        return message
    }
}
