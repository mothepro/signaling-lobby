import * as WebSocket from 'ws'
import { SafeSingleEmitter, SingleEmitter, SafeEmitter } from 'fancy-emitter'
import Client, { State } from './Client'
import Lobby from './Lobby'
import openId from '../util/openId'
import logger, { Level } from '../util/logger'
import { Max } from '../util/constants'
import { Server } from 'http'

  /** Create available IDs for the clients */
const availableId = openId(Max.SHORT)

// TODO add DoS prevention use
// TODO Simplify this by not using a class here
export default class {
  /** Number of clients in this server, both bound and unbound to a lobby. */
  // TODO improve this
  clientCount = 0

  /** Clients that have yet to join a lobby. */
  readonly pendingClients: Set<Client> = new Set

  readonly ready = new SafeSingleEmitter

  readonly close = new SingleEmitter

  readonly connection = new SafeEmitter<Client>(
    async client => {
      this.pendingClients.add(client)
      this.clientCount++
      for await (const state of client.stateChange)
        switch (state) {
          // Prepares a lobby of a specific ID and adds client to it
          case State.IN_LOBBY:
            Lobby.make(client.lobby!).clientJoin.activate(client)
          // fall-thru

          case State.DEAD:
            this.pendingClients.delete(client)

            if (state != State.IN_LOBBY) // why aren't switch statements better... smh
              this.clientCount--
            return
        }
    })

  constructor(
    server: Server,
    maxConnections: number,
    maxLength: number,
    idleTimeout: number,
    syncTimeout: number,
  ) {
    /** The underlying WebSocket server */
    const webSocketServer = new WebSocket.Server({ noServer: true })

    this.close.event.finally(() => webSocketServer.close())
    server.once('listening', this.ready.activate)
    server.once('close', this.close.activate)
    server.once('error', this.close.deactivate)

    server.on('upgrade', (request, socket, head) => {
      if (maxConnections && this.clientCount >= maxConnections) {
        logger(Level.USEFUL, 'This server is already at its max connections', maxConnections)
        socket.destroy()
      } else
        webSocketServer.handleUpgrade(request, socket, head, webSocket =>
          this.connection.activate(new Client(availableId.next().value, webSocket as WebSocket, maxLength, idleTimeout, syncTimeout)))
    })
  }
}
