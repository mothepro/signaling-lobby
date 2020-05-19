import * as WebSocket from 'ws'
import { SingleEmitter, Emitter, Listener, filterValue } from 'fancy-emitter'
import Client, { State } from './Client'
import addClientToLobby from './addClientToLobby'
import openId from '../util/openId'
import { logErr } from '../util/logger'
import { Max } from '../util/constants'
import { createServer, Server } from 'http'

/** Create available IDs for the clients */
const availableId = openId(Max.SHORT)

/** 
 * Binds an HTTP(S) server to a WebSocket server to create a lobby system.
 * 
 * Resolves with an emitter which actives with every new client.
 * The emitter is canceled once no more clients are connecting.
 */
// TODO add DoS prevention use
export default async function (
  { maxConnections, maxSize, maxLength, idleTimeout, syncTimeout }:
    {
      maxConnections: number
      maxSize: number
      maxLength: number
      idleTimeout: number
      syncTimeout: number
    },
  /** The underlying HTTP(S) connection server. */
  httpServer: Server,
  /** The underlying WebSocket server. */
  socketServer = new WebSocket.Server({ noServer: true }),
) {
  let totalConnections = 0

  /** Activated when server is ready to receive connections. */
  const ready = new SingleEmitter<Listener<Client>>(),

    /** Activated when a socket successfully connectes to the server. */
    connection = new Emitter<Client>(async client => {
      totalConnections++
      try {
        // Prepares a lobby of a specific ID and adds client to it
        await filterValue(client.stateChange, State.IN_LOBBY)
        await addClientToLobby(client.lobby!, client)
      } catch { } // Handled in Client's constructor 
      totalConnections--
    })

  httpServer.once('close', connection.cancel)
  httpServer.once('close', socketServer.close)
  httpServer.once('error', connection.deactivate)
  httpServer.once('error', ready.deactivate)
  httpServer.once('listening', () => ready.activate(connection))
  httpServer.on('upgrade', (request, socket, head) => {
    if (maxConnections && totalConnections >= maxConnections) {
      logErr('This server is already at its max connections', maxConnections)
      socket.destroy()
    } else
      socketServer.handleUpgrade(request, socket, head, webSocket => connection.activate(
        new Client(availableId.next().value, webSocket as WebSocket, maxSize, maxLength, idleTimeout, syncTimeout)))
  })

  if (httpServer.listening)
    return connection
  
  return ready.event
}
