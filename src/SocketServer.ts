import * as WebSocket from 'ws'
import { SafeSingleEmitter, SingleEmitter, SafeEmitter } from 'fancy-emitter'
import Client, { State } from './Client'
import { LobbyID } from './messages'
import Lobby from './Lobby'
import openId from './util/openId'
import logger, { Level } from './util/logger'
import { Max } from './util/constants'
import { Server } from 'http'

// TODO add DoS prevention use
export default class {

  /** Clients that have yet to join a lobby. */
  readonly pendingClients: Set<Client> = new Set

  /** Map that points to all the lobbies with clients still in it. */
  readonly lobbies: Map<LobbyID, Lobby> = new Map

  /** Create available IDs for the clients */
  private readonly ids = openId(Max.SHORT)

  readonly ready = new SafeSingleEmitter

  readonly close = new SingleEmitter

  readonly connection = new SafeEmitter<Client>(
    client => this.pendingClients.add(client),
    async client => {
      for await (const state of client.stateChange)
        switch (state) {
          // Prepares a lobby of a specific ID and adds client to it
          case State.IN_LOBBY:
            if (!this.lobbies.has(client.lobby!))
              logger(Level.INFO, 'Creating lobby', client.lobby)
                && this.lobbies.set(client.lobby!, new Lobby)
            this.lobbies.get(client.lobby!)!.clientJoin.activate(client)
            logger(Level.INFO, client.id, '> joined lobby', client.lobby, 'as', client.name)
          // fall-thru

          case State.DEAD:
            this.pendingClients.delete(client)
            break
          // return // We no longer care for status updates?
        }
    })

  /** Number of clients in this server, both bound and unbound to a lobby. */
  get clientCount() { return [...this.lobbies].reduce((prev, [, { clientCount }]) => prev + clientCount, this.pendingClients.size) }

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
          this.connection.activate(new Client(this.ids.next().value, webSocket as WebSocket, maxLength, idleTimeout, syncTimeout)))
    })
  }
}
