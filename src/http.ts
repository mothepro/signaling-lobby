import { createServer, IncomingMessage } from 'http'
import SocketServer from './SocketServer'
import logger, { Level, setLevel } from './util/logger'


export default async function (
  level = Level.SEVERE,
  port: number,
  maxConnections: number,
  maxLength: number,
  idleTimeout: number,
  syncTimeout: number,
) {
  setLevel(level)

  const server = createServer(),
    socketServer = new SocketServer(server, maxConnections, maxLength, idleTimeout, syncTimeout)


  server.listen(port)

  await socketServer.ready.event
  logger(Level.USEFUL, 'Signaling server initiated', server.address())

  try {
    await socketServer.close.event
  } catch(err) {
    logger(Level.SEVERE, 'An error occurred with the signaling server', err)
  } finally {
    logger(Level.USEFUL, 'Shutting down the signaling server')
  }
}
