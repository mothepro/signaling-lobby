import { SingleEmitter } from 'fancy-emitter'
import { ClientID, getProposal, groupJoin, groupLeave, groupFinal } from './messages'
import Client, { State } from './Client'
import logger, { Level } from './util/logger'
import { Max } from './util/constants'

export default class {

  private readonly acks: Set<ClientID> = new Set
  private readonly clientIDs = new Set([...this.clients].map(({ id }) => id))
  /** Code to be sent to the clients when group is done. */
  private readonly code = Math.trunc(Math.random() * Max.INT)

  readonly ready = new SingleEmitter(
    () => logger(Level.INFO, this.clientIDs, 'have finalized a group'),
    () => [...this.clients].map(({ stateChange }) => stateChange.activate(State.SYNCING)),
    () => [...this.clients].map(({ send }) => send(groupFinal(this.code))))

  constructor(
    initiator: Client,
    readonly clients: Set<Client>
  ) {
    logger(Level.INFO, initiator.id, '> proposed group to include', this.clientIDs)

    this.clients.add(initiator)
    this.clientIDs.add(initiator.id)
    for (const client of this.clients)
      this.bind(client)
    this.ack(initiator.id)
  }

  private ack(myId: ClientID) {
    this.acks.add(myId)
    logger(Level.INFO, myId, '> joining group of', this.clientIDs, 'so far', this.acks, 'have agreed')

    // Everyone is in!
    if (this.acks.size == this.clients.size)
      this.ready.activate()
    else
      for (const { id, send } of this.clients)
        if (id != myId) {
          const groupIds = new Set(this.clientIDs)
          // ackr will go first
          groupIds.delete(myId)
          // browser doesn't know their own id
          groupIds.delete(id)
          send(groupJoin(myId, ...groupIds))
        }
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
              if (approve)
                this.ack(client.id)
              else {
                for (const { id, send } of this.clients)
                  if (id != client.id) {
                    const groupIds = new Set(this.clientIDs)
                    // ackr will go first
                    groupIds.delete(client.id)
                    // browser doesn't know their own id
                    groupIds.delete(id)
                    send(groupLeave(client.id, ...groupIds))
                  }
                this.ready.deactivate(Error(`${client.id} doesn't want to join ${[...ids]}`))
              }
          } catch (_) { } // Ignore, the lobby will handle this
          break

        case State.SYNCING:
          for (const { id, send } of this.clients)
            if (id != client.id)
              send(data as ArrayBuffer)
          break
      }
  }
}
