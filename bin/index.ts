#!/usr/bin/env node
import { readFile } from 'fs'
import { promisify } from 'util'
import { createServer } from 'https'
import { createServer as createUnsecureServer } from 'http'
import { version } from '../package.json'
import { verbose, hostname, port, maxLength, maxSize, maxConnections, idleTimeout, syncTimeout, key, cert, anonymousPrefix } from './args'
import logger, { Level, setLevel, logErr } from '../util/logger'
import createSignalingLobby from '../src/createSignalingLobby'
const readFileAsync = promisify(readFile)

setLevel(verbose)

;(async function () { // no top level await :(

try {
  const server = key && cert
      ? createServer({
        key: await readFileAsync(key, { encoding: 'utf-8' }),
        cert: await readFileAsync(cert, { encoding: 'utf-8' }),
      })
      : createUnsecureServer(),
    connection = await createSignalingLobby(
      { maxConnections, maxSize, maxLength, idleTimeout, syncTimeout, anonymousPrefix },
      server.listen(port, hostname),
      version)

  logger(Level.SEVERE, 'Signaling Server listening', server.address())
  logger(Level.DEBUG, 'Clients must connect with protocol', version)

  // Just wait through all connections
  for await (const _ of connection)
    logger(Level.DEBUG, 'A new connection to the server has been made')
} catch (err) {
  logErr('An error occurred with the signaling server', err)
} finally {
  logger(Level.INFO, 'Shutting down the signaling server', version)
}

}())
