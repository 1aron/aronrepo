#!/usr/bin/env node

import commander from 'commander'
import path from 'path'
import '../commands'
import { readPackage } from '../utils/read-package'

const { version, name, description } = readPackage(path.join(__dirname, '../../package.json'))
commander.program
    .name(name)
    .description(description)
    .version(version)

commander.program.parse()

