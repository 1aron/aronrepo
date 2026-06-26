import parserOpts from './parser-opts'
import recommendedBumpOpts from './recommended-bump'
import writerOpts from './writer-opts'

export { default as parserOpts } from './parser-opts'
export { default as recommendedBumpOpts } from './recommended-bump'
export { default as writerOpts } from './writer-opts'

export default async function createPreset() {
    return {
        parserOpts,
        recommendedBumpOpts,
        writerOpts
    }
}
