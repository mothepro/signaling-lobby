import Client, { State } from './Client'
import { SafeEmitter } from 'fancy-emitter'
import logger, { Level } from './util/logger'
import Group, { hashIds } from './Group'
import { getProposal, ClientID, clientJoin, clientLeave } from './messages'

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
    client => [...this.clients.values()].map(({send}) => send(clientJoin(client))),

    // Tell me about everyone else
    ({ send }) => [...this.clients.values()].map(other => send(clientJoin(other))),

    // Add new client to list
    client => this.clients.set(client.id, client),

    // Message from browser
    async ({ id, message, state, failure }) => {
      for await (const data of message)
        switch (state) {
          case State.IN_LOBBY:
            try {
              const { approve, ids } = getProposal(data),
                participantHash = hashIds(id, ...ids),
                groupCreated = !this.groups.has(participantHash),
                group = groupCreated
                  ? new Group(ids.add(id)).verify(this.clients)
                  : this.groups.get(participantHash)!

              if (approve) {
                if (groupCreated) { // Create Group Proposal
                  this.groups.set(participantHash, group)
                  group.ready.event
                    .then(() => console.log('READY', group, )) // Group is all good to go!
                    .catch(e => console.error('???', e)) //
                }

                // Accept Group Proposal
                group.accept(id)
              } else { // Reject Group Proposal
                group.ready.deactivate(Error(`${id} doesn't want to join ${[...ids]}`))
              }
            } catch (e) {
              failure(e)
            }
            break

          case State.SYNCING:
            break
        }
    },

    // Remove dead clients
    async client => {
      for await (const state of client.stateChange)
        if (state == State.DEAD) {
          this.clients.delete(client.id)
          // Leave groups
          for (const group of this.groups.values())
            if (group.participants.has(client.id))
              group.ready.deactivate(Error(`${client.id} has been disconnected`))
          // Notify for deactivation
          for (const {send} of this.clients.values())
            send(clientLeave(client))
        }
    }
  )
}
