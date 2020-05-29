#!/usr/bin/env node
import { readFile } from 'fs'
import { promisify } from 'util'
import { createServer } from 'https'
import { createServer as createUnsecureServer } from 'http'
import { version } from '../package.json'
import { verbose, hostname, port, maxLength, maxSize, maxConnections, idleTimeout, syncTimeout, key, cert } from './args'
import logger, { Level, setLevel, logErr } from '../util/logger'
import createSignalingLobby from '../src/createSignalingLobby'
const readFileAsync = promisify(readFile)

setLevel(verbose)
logger(Level.USEFUL, 'Using version', version)

;(async function () { // no top level await :(

try {
  const server = key && cert
      ? createServer({
        key: await readFileAsync(key, { encoding: 'utf-8' }),
        cert: await readFileAsync(cert, { encoding: 'utf-8' }),
      })
      : createUnsecureServer(),
    connection = await createSignalingLobby(
      { maxConnections, maxSize, maxLength, idleTimeout, syncTimeout },
      server.listen(port, hostname),
      version)

  logger(Level.USEFUL, 'Signaling Server listening', server.address())
  logger(Level.INFO, 'Clients must connect with protocol', version)

  // Just wait through all connections
  for await (const _ of connection)
    logger(Level.TRANSFER, 'A new connection to the server has been made')
} catch (err) {
  logErr('An error occurred with the signaling server', err)
} finally {
  logger(Level.USEFUL, 'Shutting down the signaling server', version)
}

}())
