import { strict } from 'yargs'
import { version, name, description } from '../package.json'

export const {
  verbose,
  hostname,
  port,
  key,
  cert,
  'max-length': maxLength,
  'max-connections': maxConnections,
  'idle-timeout': idleTimeout,
  'sync-timeout': syncTimeout,
} = strict()
  .version(version)
  .help()
  .usage(`${description}\nUsage: ${name} [options]`)
  .count('verbose')
  .alias('v', 'verbose')
  .option('max-length', {
    type: 'number',
    description: 'The max length of a user\'s name',
    default: 15,
    demandOption: true,
  })
  .option('max-connections', {
    type: 'number',
    description: 'The max number of connections the server supports',
    default: 2 ** 16,
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
  .option('sync-timeout', {
    alias: 's',
    type: 'number',
    description: 'The number of milliseconds a client will be connected to the server once syncing is complete',
    defaultDescription: '30 seconds',
    default: 30 * 1000,
    demandOption: true,
  })
  .option('hostname', {
    alias: 'h',
    type: 'string',
    description: 'The hostname to this server is running on',
    default: 'localhost',
    demandOption: true,
  })
  .option('port', {
    alias: 'p',
    type: 'number',
    description: 'The port this server is running on',
    defaultDescription: 'A random free port',
    default: 0,
    demandOption: true,
  })
  .option('key', {
    type: 'string',
    description: 'Path to the public key to use (Only for a secure server)',
  })
  .option('cert', {
    type: 'string',
    description: 'Path to the certificate to use (Only for a secure server)',
  })
    .argv
