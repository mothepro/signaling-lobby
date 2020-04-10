
import * as WebSocket from 'ws'
import { ClientID, LobbyID } from './util/messages'
import Client, { State } from './Client'
import Lobby from './Lobby'
import openId from './util/openId'

// The next client ID to assign to a peer
let nextID: ClientID = 1

// TODO add DoS prevention use
// potenetially using 'headers' event and & shouldHandle method
export default class {
  /** All clients not in a lobby */
  private readonly pendingClients: Set<Client> = new Set

  /** Lobbies currently in use. */
  private readonly lobbies: Map<LobbyID, Lobby> = new Map

  private readonly host: WebSocket.Server

  private readonly ids = openId(this.maxConnections)

  constructor(
    private readonly log: Function,
    port: number,
    maxPayload: number,
    // TODO unused
    private readonly maxConnections: number,
    private readonly maxNameLength: number,
    private readonly idleTimout: number,
    // Possibly the same as connections
    backlog = maxConnections,
  ) {
    this.host = new WebSocket.Server({port, backlog, maxPayload, clientTracking: false, perMessageDeflate: false})
    this.host.on('listening', this.onStart)
    this.host.on('error', this.onError)
    this.host.on('close', this.onClose)
    this.host.on('connection', this.onConnection)
  }

  private onStart = () => this.log('Signaling server initiated on', this.host.address())
  private onClose = () => this.log('Shutting down the signaling server.')
  private onError = (err: Error) => {
    this.log('An error occurred with the signaling server', err)
    this.host.close()
  }

  /** A new client has connected. */
  private onConnection = async (socket: WebSocket) => {
    const client = new Client(this.ids.next().value, socket, this.maxNameLength, this.idleTimout, this.log)
    this.pendingClients.add(client)
    for await (const state of client.stateChange)
      switch (state) {
        case State.DEAD:
          this.pendingClients.delete(client)
          break

        case State.LOBBY_READY:
          this.getLobby(client.lobby!).addClient(client)
          break
      }
  }

  /** Prepares a lobby of a specific ID. */
  private getLobby = (id: LobbyID) => {
    if (!this.lobbies.has(id))
      this.lobbies.set(id, new Lobby)
    return this.lobbies.get(id)!
  }
}
