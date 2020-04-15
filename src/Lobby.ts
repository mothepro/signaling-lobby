import Client, { State } from './Client'
import { SafeEmitter } from 'fancy-emitter'
import logger, { Level } from './util/logger'
import Group from './Group'
import { getProposal, ClientID, clientJoin, clientLeave } from './messages'

// sort order doesn't matter as long as it is always consistent
export const hashIds = (...ids: ClientID[]) => ids.sort().join()

export default class {
  /** All the clients */
  private readonly clients: Map<ClientID, Client> = new Map

  /**
   * List of pending groups.
   * 
   * Keys are the clients in the suggested group.
   * Values are the clients who have accepted so far.
   */
  private readonly groups: Map<string, Group> = new Map

  readonly clientJoin = new SafeEmitter<Client>(
    // Tell everyone else about me
    client => [...this.clients.values()].map(({ send }) => send(clientJoin(client))),

    // Tell me about everyone else
    ({ send }) => [...this.clients.values()].map(other => send(clientJoin(other))),

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
          
          // Notify for deactivation if the client still 
          for (const { send, state: otherState } of this.clients.values())
            if (otherState == State.IN_LOBBY)
              send(clientLeave(client))
          
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
    
    try {
      logger(Level.INFO, initiator.id, '> proposed group to include', ids)

      const group = new Group(initiator, participants)
      this.groups.set(hash, group)

      await group.ready.event
      return // stop listener, it is done
    } catch (e) {
      logger(Level.DEBUG, 'Group deleted', e)
    } finally {
      this.groups.delete(hash)
    }
  }
}
