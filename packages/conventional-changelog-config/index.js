const conventionalChangelog = require('./changelog')
const recommendedBumpOpts = require('./recommended-bump')
const parserOpts = require('./parser-opts')
const writerOpts = require('./writer-opts')

module.exports = {
    conventionalChangelog,
    parserOpts,
    recommendedBumpOpts,
    writerOpts
}