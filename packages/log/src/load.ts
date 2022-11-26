import ora, { Options, Ora } from 'ora'
import { generalSpinner } from './utils/general-spinner'
import { getText } from './utils/get-text'

interface LogLoading extends Ora {
    log: (event: string, message?: string) => Ora
}

const load = (event: string, message?: string, options?: Options): Ora => {
    if (event && !message) {
        message = event
        event = ''
    }
    const loading = ora(Object.assign({
        spinner: event === 'watching' ? 'dots12' : generalSpinner
    }, options || {}))
        .start(getText(event, message)) as LogLoading
    loading.log = (event: string, message?: string) => {
        loading.stop()
        return load(event, message)
    }
    return loading
}

export { load }