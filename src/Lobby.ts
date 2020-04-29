import Client, { State } from './Client'
import { SafeEmitter } from 'fancy-emitter'
import logger, { Level } from '../util/logger'
import Group from './Group'
import { getProposal, ClientID, clientJoin, clientLeave, LobbyID } from './messages'

export default class Lobby {
  /** Map that points to all the lobbies with clients still in it. */
  private static lobbies: Map<LobbyID, Lobby> = new Map

  /** Gets a lobby with the given ID. Creates a new Lobby if one doesn't exist. */
  static make(id: LobbyID) {
    if (!Lobby.lobbies.has(id)) {
      logger(Level.INFO, 'Creating lobby', id)
      Lobby.lobbies.set(id, new Lobby)
    }
    return Lobby.lobbies.get(id)!
  }

  private constructor() { }

  /** All the clients */
  private readonly clients: Map<ClientID, Client> = new Map

  readonly clientJoin = new SafeEmitter<Client>(
    ({ id, lobby, name }) => logger(Level.INFO, id, '> joined lobby', lobby, 'as', name),

    // Tell everyone else about me
    client => [...this.clients].map(([, { send }]) => send(clientJoin(client))),

    // Tell me about everyone else
    ({ send }) => [...this.clients].map(([, other]) => send(clientJoin(other))),

    // Add new client to list
    client => this.clients.set(client.id, client),

    // Message from browser
    async (client) => {
      for await (const data of client.message)
        if (client.state == State.IN_LOBBY)
          try {
            const { approve, ids } = getProposal(data)
            if (approve) {
              const participants = []

              // TODO, make this a one liner
              for (const clientId of ids)
                if (this.clients.has(clientId) && clientId != client.id)
                  participants.push(this.clients.get(clientId)!)
                else
                  // TODO decide if client should be kicked for this
                  logger(Level.DEBUG, client.id, '> tried to add some non-existent members to group', ids)

              // TODO decide if client should be kicked for this
              if (!participants.length)
                logger(Level.DEBUG, client.id, '> Tried to make a group without members')
              
              Group.make(client, ...participants)
            }
          } catch (e) {
            client.failure(e)
          }
    },

    // Remove dead clients
    // TODO remove lobby if it is empty
    async client => {
      for await (const state of client.stateChange)
        if (state == State.DEAD || state == State.SYNCING) {
          this.clients.delete(client.id)

          // Notify for client leaving on the next tick to allow dead clients to be removed first
          setImmediate(() => [...this.clients.values()].map(({ send }) => send(clientLeave(client))))

          return // stop listener, it is done
        }
    })
}
