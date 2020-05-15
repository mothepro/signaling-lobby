import * as WebSocket from 'ws'
import { SafeSingleEmitter, Emitter, Listener } from 'fancy-emitter'
import Client, { State } from './Client'
import addToLobby from './Lobby'
import openId from '../util/openId'
import { logErr } from '../util/logger'
import { Max } from '../util/constants'
import { createServer } from 'http'

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
  httpServer = createServer(),
  /** The underlying WebSocket server. */
  socketServer = new WebSocket.Server({ noServer: true }),
): Promise<Listener<Client>> {
  let totalConnections = 0

  /** Activated when server is ready to receive connections. */
  const ready = new SafeSingleEmitter,

    /** Activated when a socket successfully connectes to the server. */
    connection = new Emitter<Client>(async client => {
      totalConnections++
      try {
        // Prepares a lobby of a specific ID and adds client to it
        for await (const state of client.stateChange)
          if (state == State.IN_LOBBY)
            addToLobby(client.lobby!, client)
      } catch { } // Handled in Client's constructor 
      totalConnections--
    })

  httpServer.once('close', connection.cancel)
  httpServer.once('close', socketServer.close)
  httpServer.once('error', connection.deactivate)
  httpServer.once('listening', ready.activate)
  if (httpServer.listening)
    ready.activate()

  httpServer.on('upgrade', (request, socket, head) => {
    if (maxConnections && totalConnections >= maxConnections) {
      logErr('This server is already at its max connections', maxConnections)
      socket.destroy()
    } else
      socketServer.handleUpgrade(request, socket, head, webSocket => connection.activate(
        new Client(availableId.next().value, webSocket as WebSocket, maxSize, maxLength, idleTimeout, syncTimeout)))
  })

  await ready.event
  return connection
}
