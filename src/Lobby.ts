import Client, { State } from './Client'
import { SafeEmitter } from 'fancy-emitter'
import logger, { Level } from './util/logger'
import Group from './Group'
import { getProposal, ClientID, clientJoin, clientLeave } from './messages'

// sort order doesn't matter as long as it is always consistent
export const hashIds = (...ids: ClientID[]) => ids.sort().join()

export default class {
  /** All the clients */
  readonly clients: Map<ClientID, Client> = new Map

  /** List of pending groups. */
  private readonly groups: Map<string, Group> = new Map

  readonly clientJoin = new SafeEmitter<Client>(
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
            if (approve && !this.groups.has(hashIds(client.id, ...ids)))
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

          // Leave groups
          for (const group of this.groups.values())
            if (group.clients.has(client))
              group.ready.deactivate(Error(`${client.id} has been disconnected`))

          // Notify for client leaving on the next tick to allow dead clients to be removed first
          setImmediate(() => [...this.clients].map(([, { send }]) => send(clientLeave(client))))

          return // stop listener, it is done
        }
    })

  /** Create and clean up a group once it is no longer needed. */
  async makeGroup(initiator: Client, ...ids: ClientID[]) {
    const participants: Set<Client> = new Set,
      hash = hashIds(initiator.id, ...ids)

    for (const clientId of ids)
      if (this.clients.has(clientId))
        participants.add(this.clients.get(clientId)!)
      else
        return logger(Level.DEBUG, initiator.id, '> tried to add some non-existent members to group', ids)
    logger(Level.INFO, initiator.id, '> proposed group to include', ids)

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
