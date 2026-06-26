import { sync as parseCommit } from 'conventional-commits-parser'
import { types } from './commits.js'

const parserOpts = {
    headerPattern: /^([A-Z]\w*)(?:\(([0-9A-Z`_#~].*)\))?: ([0-9A-Z`_#~].*)$/,
    headerCorrespondence: ['type', 'scope', 'subject']
}

export default async function validateTitle(title) {
    const result = parseCommit(title, parserOpts)

    if (!result.type) {
        throw new Error(`No release type found in pull request title "${title}". Add a prefix like "Fix: " or "Feat: ".`)
    }

    if (!types.includes(result.type)) {
        throw new Error(`Unknown release type "${result.type}" found in pull request title "${title}". Please use one of these recognized types: ${types.join(', ')}.`)
    }
}
