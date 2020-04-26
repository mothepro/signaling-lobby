import { SingleEmitter } from 'fancy-emitter'
import { ClientID, getProposal, groupJoin, groupLeave, groupFinal } from './messages'
import Client, { State } from './Client'
import logger, { Level } from '../util/logger'
import { Max } from '../util/constants'

class LeaveGroupError extends Error {
  constructor(
    /** ID of the client who causes group to close. */
    readonly id: ClientID,
    message?: string
  ) { super(message) }
}

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

    // Notify all other clients when a group fails.
    this.ready.event.catch((e: LeaveGroupError) => {
      for (const { id, send } of this.clients)
        if (id != e.id) {
          const groupIds = new Set(this.clientIDs)
          // ackr will go first
          groupIds.delete(e.id)
          // browser doesn't know their own id
          groupIds.delete(id)
          send(groupLeave(e.id, ...groupIds))
        }
    })
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
    // Remove client once it is dead so it can be GC'd.
    client.stateChange.on(state => state == State.DEAD
      && this.clients.delete(client)
      && this.ready.deactivate(new LeaveGroupError(client.id, `${client.id} disconnected while in potential group with ${[...this.clientIDs]}`)))

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
              else
                this.ready.deactivate(new LeaveGroupError(client.id, `${client.id} doesn't want to join ${[...ids]}`))
          } catch (_) { } // Ignore, the lobby will handle this
          break

        case State.SYNCING:
          const view = new DataView(data as ArrayBuffer),
            to = view.getUint16(0, true)
          view.setUint16(0, client.id, true)
            
          for (const { id, send } of this.clients)
            if (id == to && to != client.id)
              send(view.buffer)
          break
      }
  }
}
