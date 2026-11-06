import { headerPattern } from '@aronrepo/conventional-commits'

const parserOpts = {
    headerPattern,
    headerCorrespondence: [
        'type',
        'scope',
        'subject'
    ],
    noteKeywords: ['BREAKING CHANGE', 'BREAKING-CHANGE'],
    revertPattern: /^(?:Revert|Revert:)\s"?([\s\S]+?)"?\s*This reverts commit (\w*)\./i,
    revertCorrespondence: ['header', 'hash']
}

export default parserOpts
