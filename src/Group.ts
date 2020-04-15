import { SingleEmitter } from 'fancy-emitter'
import { ClientID, getProposal } from './messages'
import Client, { State } from './Client'
import logger, { Level } from './util/logger'

export default class {

  private readonly acks: Set<ClientID> = new Set
  private readonly clientIDs = new Set([...this.clients].map(({id}) => id))

  readonly ready = new SingleEmitter(() => {
    // TODO make all activate at same time so they don't get "leavers"
    for (const client of this.clients)
      client.stateChange.activate(State.SYNCING)
  })

  constructor(
    initiator: Client,
    readonly clients: Set<Client>
  ) {
    this.acks.add(initiator.id)
    this.clients.add(initiator)
    this.clientIDs.add(initiator.id)
    
    if (this.clients.size <= 1)
      this.ready.deactivate(Error('Not enough members to make a group'))
    
    for (const client of this.clients)
      this.bind(client)
  }

  private async bind(client: Client) {
    for await (const data of client.message)
      switch (client.state) {
        case State.IN_LOBBY:
          try {
            const { approve, ids } = getProposal(data)
            ids.add(client.id)

            // Only handle if group belongs to us, and only us
            if (ids.size == this.clients.size && ![...ids].filter(id => !this.clientIDs.has(id)).length)
              if (approve) {
                logger(Level.INFO, client.id, '> joining group with', ids, 'acks (before)', this.acks)

                this.acks.add(client.id)

                // Everyone is in!
                if (this.acks.size == this.clients.size)
                  this.ready.activate()
              } else
                this.ready.deactivate(Error(`${client.id} doesn't want to join ${[...ids]}`))
          } catch (_) { } // Ignore, the lobby will handle this
          break

        case State.SYNCING:
          break
      }
  }
}
