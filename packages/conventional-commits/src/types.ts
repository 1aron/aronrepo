const commits = require('.')

module.exports = [
    ...new Set(commits.map(({ type }) => type))
]