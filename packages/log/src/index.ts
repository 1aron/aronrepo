import chalk from 'chalk'

type Log = (strings: string[], ...messages: string[]) => void

const log = <{
    (strings, ...messages: string[]): void
    error: Log,
    info: Log, i: Log,
    watch: Log, w: Log,
    pass: Log,
    success: Log,
    warn: Log,
    fail: Log,
    x: Log, invalid: Log,
    o: Log, valid: Log
    check: Log,
}>((strings, ...slots) => {
    handleMessage({ strings, slots })
})

log.error = (strings, ...slots) => {
    return handleMessage({
        strings, slots,
        message: chalk.bgRed.bold.white(' ⛌ ERROR '),
        markEvent: (event) => chalk.bgBlack.red(` ${event} `)
    })
}

log.check = (strings, ...slots) => {
    return handleMessage({
        strings, slots,
        header: chalk.green('✓'),
        markEvent: (event) => chalk.green(event)
    })
}

log.o = log.valid = (strings, ...slots) => {
    return handleMessage({
        strings, slots,
        header: chalk.green('○'),
        markEvent: (event) => chalk.green(event)
    })
}

log.x = log.invalid = (strings, ...slots) => {
    return handleMessage({
        strings, slots,
        header: chalk.red('✗'),
        markEvent: (event) => chalk.red(event)
    })
}

log.info = log.i = (strings, ...slots) => {
    return handleMessage({
        strings, slots,
        header: chalk.dim(new Date().toLocaleTimeString()),
        markEvent: (event) => chalk.dim('[') + chalk.cyan(event) + chalk.dim(']')
    })
}

log.watch = log.w = (strings, ...slots) => {
    return handleMessage({
        strings, slots,
        header: chalk.dim(new Date().toLocaleTimeString()),
        event: 'watch',
        markEvent: (event) => chalk.dim('[') + chalk.cyan(event) + chalk.dim(']')
    })
}

log.success = (strings, ...slots) => {
    return handleMessage({
        strings, slots,
        header: chalk.green('⏺'),
        event: 'Success',
        markEvent: (event) => chalk.bold.green(event),
    })
}

log.warn = (strings, ...slots) => {
    return handleMessage({
        strings, slots,
        header: chalk.yellow('⏺'),
        event: 'Warn',
        markEvent: (event) => chalk.bold.yellow(event),
    })
}

log.fail = (strings, ...slots) => {
    return handleMessage({
        strings, slots,
        header: chalk.red('⏺'),
        event: 'Fail',
        markEvent: (event) => chalk.bold.red(event),
    })
}

log.pass = (strings, ...slots) => {
    return handleMessage({
        strings, slots,
        message: chalk.bgGreen.bold.white(' ✓ PASS '),
        markEvent: (event) => chalk.bgBlack.green(` ${event} `)
    })
}

function handleMessage({ strings, slots, message = '', header, event, markEvent }: {
    strings: string[],
    slots: string[],
    event?: string,
    header?: string,
    message?: string,
    markEvent?: (event: string) => string
}) {
    for (let i = 0; i < strings.length; i++) {
        const str = strings[i]
        const slot = slots[i]
        if (i === 0) {
            if (!str && slot && markEvent) {
                message += markEvent(slot)
                continue
            } else if (event && markEvent) {
                message += markEvent(event)
            } else if (str) {
                message += ' '
            }
            if(message[message.length -1] !== ' ') {
                message += ' '
            }
        }
        message += (str + (slot ? mark(slot) : ''))
    }
    console.log((header ? header + ' ': '') + message.trim())
    return log
}

export function mark(event: string) {
    const newSlot = event
        .replace(/\*(.*?)\*/g, chalk.cyan('$1'))
        .replace(/_(.*?)_/g, chalk.underline('$1'))
        .replace(/\/(.*?)\//g, chalk.italic('$1'))
        .replace(/-(.*?)-/g, chalk.red('$1'))
        .replace(/~(.*?)~/g, chalk.strikethrough('$1'))
        .replace(/!(.*?)!/g, chalk.yellow('$1'))
        .replace(/\+(.*?)\+/g, chalk.green('$1'))
        .replace(/\.(.*?)\./g, chalk.dim('$1'))
        .replace(/`(.*?)`/g, chalk.blue('`$1`'))
    if (event === newSlot) {
        return chalk.blue(event)
    } else {
        return newSlot
    }
}

export default log