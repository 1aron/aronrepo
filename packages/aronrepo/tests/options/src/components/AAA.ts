import { aUtil } from '../utils/a-util'

const hasFn = typeof Function !== 'undefined'

const AAA = /* @__PURE__ */  (() => class AAA extends (hasFn ? Function : Object) {
    _fullAAAMembership = 1
    static staticMembership = 100
    constructor() {
        super()
        console.log(this._fullAAAMembership, aUtil())
    }
})()

export { AAA }