#!/usr/bin/env node
const fs = require('fs-extra')
const program = require('commander')
const path = require('path')
const { version, name, description } = fs.readJSONSync(path.join(__dirname, '../package.json'))
const fg = require('fast-glob')

program
    .name(name)
    .description(description)
    .version(version | 'dev')

fg.sync(path.join(__dirname, '../commands/*')).forEach((eachCommandPath) => {
    require(eachCommandPath)
})

program.parse()

