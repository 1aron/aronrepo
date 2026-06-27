import { types } from '@aronrepo/conventional-commits'
import { parserOpts } from '@aronrepo/conventional-changelog-config'

const config = {
    parserPreset: {
        parserOpts
    },
    rules: {
        'body-leading-blank': [1, 'always'],
        'footer-leading-blank': [1, 'always'],
        'header-case': [2, 'always', 'sentence-case'],
        'scope-case': [2, 'always', 'sentence-case'],
        'subject-case': [2, 'always', ['sentence-case']],
        'subject-exclamation-mark': [2, 'never'],
        'subject-full-stop': [2, 'never', '.'],
        'type-case': [2, 'always', ['sentence-case', 'upper-case']],
        'type-enum': [2, 'always', types]
    }
}

export default config
