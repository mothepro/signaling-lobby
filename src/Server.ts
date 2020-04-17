import * as WebSocket from 'ws'
import { SafeSingleEmitter, SingleEmitter, SafeEmitter } from 'fancy-emitter'
import Client, { State } from './Client'
import { LobbyID } from './messages'
import Lobby from './Lobby'
import openId from './util/openId'
import logger, { Level } from './util/logger'

// TODO add DoS prevention use
export default class {

  readonly pendingClients: Set<Client> = new Set

  readonly lobbies: Map<LobbyID, Lobby> = new Map

  /** The web server */
  // TODO potenetially using 'headers' event and & shouldHandle method
  private readonly host: WebSocket.Server

  /** Create available IDs for the clients */
  private readonly ids = openId(0xFFFF)

  readonly listening = new SafeSingleEmitter(() => logger(Level.USEFUL, 'Signaling server initiated', this.host.address()))

  readonly close = new SingleEmitter(() => logger(Level.USEFUL, 'Shutting down the signaling server'))

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

  get allClients() {
    const allClients = new Set(this.pendingClients)
    for (const lobby of this.lobbies.values())
      for (const client of lobby.clients.values())
        allClients.add(client)
    return allClients
  }

  get address() { return this.host.address() as WebSocket.AddressInfo }

  constructor(
    port: number,
    maxPayload: number,
    maxConnections: number,
    maxNameLength: number,
    idleTimeout: number,
    // Possibly the same as connections
    backlog = maxConnections
  ) {
    this.host = new WebSocket.Server({ port, backlog, maxPayload, clientTracking: false, perMessageDeflate: false })
    this.close.event.catch(err => logger(Level.SEVERE, 'An error occurred with the signaling server', err) && this.host.close())

    this.host.once('listening', this.listening.activate)
    this.host.once('close', this.close.activate)
    this.host.once('error', this.close.deactivate)
    this.host.on('connection', async (socket: WebSocket) => {
      if (maxConnections && this.allClients.size >= maxConnections) {
        logger(Level.USEFUL, 'This server is already at its max connections', maxConnections)
        socket.close()
        return
      }

      this.connection.activate(new Client(this.ids.next().value, socket, maxNameLength, idleTimeout))
    })
  }
}
