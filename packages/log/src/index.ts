import { mark } from './mark'
import { add } from './add'
import { error } from './error'
import { log } from './log'
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
    tree
})

export default log
export { mark }
export * from '../types'