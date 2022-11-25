import { Log } from 'types'
import { handle } from './handle'

const log = <{
    (strings: TemplateStringsArray, ...messages: any[]): void
    error: Log,
    conflict: Log,
    pass: Log,

    info: Log, i: Log,
    watch: Log, w: Log,

    success: Log,
    warn: Log,
    fail: Log,

    x: Log, invalid: Log,
    o: Log, valid: Log

    ok: Log,
    d: Log, delete: Log,
    a: Log, add: Log

    tree: (object: object | JSON) => void
}>((strings, ...slots) => {
    handle({ strings, slots })
})

export { log }