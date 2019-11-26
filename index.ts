#!/usr/bin/env node
import { strict } from 'yargs'
import { version, name as thisPkgName, description as thisPkgDescription } from './package.json'

const {
  verbose,
  'clean-name': cleanName,
  'max-length': maxLength,
} = strict()
  .demandCommand()
  .version(version)
  .help()
  .usage(`${thisPkgDescription}
  Usage: ${thisPkgName} [options]`)
  .option('verbose', {
    alias: 'v',
    description: 'Whether to output status of server',
    default: false,
    type: 'boolean',
  })
  .option('clean-name', {
    alias: 'c',
    type: 'boolean',
    description: 'Whether to fix the names given from users (Trim, remove zero width chars)',
    default: true,
    demandOption: true,
  })
  .option('max-length', {
    alias: 'l',
    type: 'number',
    description: 'The max length of a user\'s name',
    default: 15,
    demandOption: true,
  })
  .option('port', {
    alias: 'p',
    type: 'number',
    description: 'The port to host this server on',
  })
    .argv
