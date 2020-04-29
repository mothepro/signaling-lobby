import Client, { State } from './Client'
import { SafeEmitter } from 'fancy-emitter'
import logger, { Level } from '../util/logger'
import Group from './Group'
import { getProposal, ClientID, clientJoin, clientLeave, LobbyID } from './messages'

export default class Lobby {
  /** Map that points to all the lobbies with clients still in it. */
  private static lobbies: Map<LobbyID, Lobby> = new Map

  /**
   * Turns a list of client IDs to a hashed string
   * Sort order doesn't matter as long as it is always consistent
   */
  private static hashIds = (...ids: ClientID[]) => ids.sort().join()

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

  /** List of pending groups. */
  private readonly groups: Map<string, Group> = new Map

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

            // Recieved a Create Group Proposal
            if (approve && !this.groups.has(Lobby.hashIds(client.id, ...ids)))
              this.makeGroup(client, ...ids)
          } catch (e) {
            client.failure(e)
          }
    },

    // Remove dead clients
    async client => {
      for await (const state of client.stateChange)
        if (state == State.DEAD || state == State.SYNCING) {
          this.clients.delete(client.id)

          // Notify for client leaving on the next tick to allow dead clients to be removed first
          setImmediate(() => [...this.clients].map(([, { send }]) => send(clientLeave(client))))

          return // stop listener, it is done
        }
    })

  /** Create and clean up a group once it is no longer needed. */
  async makeGroup(initiator: Client, ...ids: ClientID[]) {
    const participants: Set<Client> = new Set,
      hash = Lobby.hashIds(initiator.id, ...ids)

    for (const clientId of ids)
      if (this.clients.has(clientId) && clientId != initiator.id)
        participants.add(this.clients.get(clientId)!)
      else
        // TODO decide if client should be kicked for this
        return logger(Level.DEBUG, initiator.id, '> tried to add some non-existent members to group', ids)

    // TODO decide if client should be kicked for this
    if (!participants.size)
      return logger(Level.DEBUG, initiator.id, '> Tried to make a group without members')

    try {
      const group = new Group(initiator, participants)
      this.groups.set(hash, group)
      await group.ready.event
    } catch (e) {
      logger(Level.DEBUG, 'Group deleted', e)
    }
    this.groups.delete(hash)
  }
}
