#!/usr/bin/env node
import { strict } from 'yargs'
import { version, name as thisPkgName, description as thisPkgDescription } from './package.json'
import Server from './src/Server'

const {
  verbose,
  port,
  'max-length': maxLength,
  'max-connections': maxConnections,
  'max-payload': maxPayload,
  'idle-timeout': idleTimeout,
} = strict()
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
  .option('max-length', {
    type: 'number',
    description: 'The max length of a user\'s name',
    default: 15,
    demandOption: true,
  })
  .option('max-connections', {
    type: 'number',
    description: 'The max number of connections the server supports',
    default: 2 ** 16 - 2,
    demandOption: true,
  })
  .option('max-payload', {
    type: 'number',
    description: 'The max length of a user\'s message',
    defaultDescription: 'A kilobyte',
    default: 2 ** 10,
    demandOption: true,
  })
  .option('idle-timeout', {
    alias: 'i',
    type: 'number',
    description: 'The number of milliseconds a client can be connected to the server without joining a group',
    defaultDescription: '20 minutes',
    default: 20 * 60 * 1000,
    demandOption: true,
  })
  .option('port', {
    alias: 'p',
    type: 'number',
    description: 'The port to host this server on',
    defaultDescription: 'A random free port',
    default: 0,
    demandOption: true,
  })
    .argv

new Server(verbose ? console.log : () => { }, port, maxPayload, maxConnections, maxLength, idleTimeout)
