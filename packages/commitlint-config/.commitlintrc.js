const conventionalCommits = require('aron-conventional-commits')
const types = require('aron-conventional-commits/types')

module.exports = {
    parserPreset: 'conventional-changelog-aron',
    rules: {
        'subject-exclamation-mark': [2, 'never'],
        'body-leading-blank': [1, 'always'],
        'footer-leading-blank': [1, 'always'],
        'scope-case': [2, 'always', 'sentence-case'],
        'subject-case': [
            2,
            'always',
            ['sentence-case'],
        ],
        'subject-empty': [2, 'never'],
        'subject-full-stop': [2, 'never', '.'],
        'type-case': [2, 'always', 'sentence-case'],
        'type-empty': [2, 'never'],
        'type-enum': [
            2,
            'always',
            types
        ]
    }
}