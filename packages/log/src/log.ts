import { Log } from 'types'
import { handle } from './handle'
import { mark } from './mark'

import { add } from './add'
import { error } from './error'
import { conflict } from './conflict'
import { ok } from './ok'
import { del } from './del'
import { valid } from './valid'
import { invalid } from './invalid'
import { info } from './info'
import { success } from './success'
import { warn } from './warn'
import { pass } from './pass'
import { tree } from './tree'
import { watch } from './watch'
import { fail } from './fail'
import { load } from './load'

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

Object.assign(log, {
    a: add, add,
    d: del, del,
    o: valid, valid,
    x: invalid, invalid,
    i: info, info,
    w: watch, watch,
    success,
    error,
    fail,
    warn,
    pass,
    conflict,
    ok,
    tree,
    load,
    mark
})

export { log }