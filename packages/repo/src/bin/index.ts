#!/usr/bin/env node
import fs from 'fs-extra'
import program from 'commander'
import path from 'path'
import '../commands'

const { version, name, description } = fs.readJSONSync(path.join(__dirname, '../../package.json'))

program
    .name(name)
    .description(description)
    .version(version)

program.parse()

