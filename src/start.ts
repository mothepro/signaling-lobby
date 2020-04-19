import { readFile } from 'fs'
import { promisify } from 'util'
import { createServer } from 'https'
import { createServer as createUnsecureServer } from 'http'
import logger, { Level, setLevel } from './util/logger'
import SocketServer from './SocketServer'

const readFileAsync = promisify(readFile)

export default async function (
  level = Level.SEVERE,
  port: number,
  maxConnections: number,
  maxLength: number,
  idleTimeout: number,
  syncTimeout: number,
  keyPath?: string,
  certPath?: string,
) {
  try {
    setLevel(level)

    const server = keyPath && certPath
      ? createServer({
        key: await readFileAsync(keyPath, { encoding: 'utf-8' }),
        cert: await readFileAsync(certPath, { encoding: 'utf-8' }),
      }).listen(port)
      : createUnsecureServer().listen(port),
      socketServer = new SocketServer(server, maxConnections, maxLength, idleTimeout, syncTimeout)

    await socketServer.ready.event
    logger(Level.USEFUL, 'Signaling server initiated', server.address())

    await socketServer.close.event
  } catch (err) {
    logger(Level.SEVERE, 'An error occurred with the signaling server', err)
  } finally {
    logger(Level.USEFUL, 'Shutting down the signaling server')
  }
}
