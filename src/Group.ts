import { SingleEmitter } from 'fancy-emitter'
import { ClientID, getProposal, groupJoin, groupLeave, groupFinal, getSyncBuffer } from './messages'
import Client, { State } from './Client'
import logger, { Level } from '../util/logger'
import { Max } from '../util/constants'

class LeaveError extends Error {
  constructor(
    /** ID of the client who causes group to close. */
    readonly id: ClientID,
    message?: string
  ) { super(message) }
}

export default class Group {
  /** Map that points to all the groups with clients still in it. */
  private static groups: Map<string, Group> = new Map

  /**
   * Turns a list of client IDs to a hashed string
   * Sort order doesn't matter as long as it is always consistent
   */
  private static hashIds = (...ids: ClientID[]) => ids.sort().join()

  /** Gets a Group with the given members. Creates a new Group if one doesn't exist. */
  static make(initiator: Client, ...clients: Client[]) {
    const hash = Group.hashIds(initiator.id, ...clients.map(({ id }) => id))

    if (!Group.groups.has(hash))
      Group.groups.set(hash, new Group(initiator, ...clients))
    return Group.groups.get(hash)!
  }

  private readonly acks: Set<ClientID> = new Set

  private readonly clients: Map<ClientID, Client> = new Map

  /** Code to be sent to the clients when group is done. */
  private readonly code = Math.trunc(Math.random() * Max.INT)

  readonly ready = new SingleEmitter(
    () => logger(Level.INFO, ...this.clients.keys(), 'have finalized a group'),
    () => [...this.clients].map(([, { stateChange }]) => stateChange.activate(State.SYNCING)),
    () => [...this.clients].map(([id, { send }]) => send(groupFinal(this.code, ...this.idsWithout(id))))) // browser doesn't know their own id

  /** Create and clean up a group once it is no longer needed. */
  private constructor(initiator: Client, ...clients: Client[]) {
    this.clients.set(initiator.id, initiator)
    for (const client of clients)
      this.clients.set(client.id, client)

    // This must be done since async isn't allowed in constructor & binds can't "overlap".
    for (const [, client] of this.clients) {
      this.bindState(client)
      this.bindMessage(client)
    }

    logger(Level.INFO, initiator.id, '> proposed group to include', ...this.clients.keys())
    this.ack(initiator.id)

    // Notify all other clients when a group fails.
    this.ready.event.catch((e: LeaveError) => {
      for (const [id, { send }] of this.clients)
        if (id != e.id)
          send(groupLeave(e.id, ...this.idsWithout(e.id, id))) // ackr will go first & browser doesn't know their own id
    })
      .finally(() => Group.groups.delete(Group.hashIds(...this.clients.keys())))
  }

  /** All the client IDs in this group without `ids`. */
  private idsWithout(...ids: ClientID[]) {
    const all = new Set(this.clients.keys())
    for (const id of ids)
      all.delete(id)
    return all
  }

  private ack(ackerId: ClientID) {
    this.acks.add(ackerId)
    logger(Level.INFO, ackerId, '> joining group of', ...this.clients.keys(), 'so far', this.acks, 'have agreed')

    // Everyone is in!
    if (this.acks.size == this.clients.size)
      this.ready.activate()
    else
      for (const [id, { send }] of this.clients)
        if (id != ackerId)
          send(groupJoin(ackerId, ...this.idsWithout(ackerId, id))) // ackr will go first & browser doesn't know their own id
  }

  private async bindMessage(client: Client) {
    for await (const data of client.message)
      switch (client.state) {
        case State.IN_LOBBY:
          try {
            const { approve, ids } = getProposal(data)
            ids.add(client.id)

            // Only handle if group belongs to us, and only us
            if (ids.size == this.clients.size && ![...ids].filter(id => !this.clients.has(id)).length)
              if (approve)
                this.ack(client.id)
              else
                this.ready.deactivate(new LeaveError(client.id, `${client.id} doesn't want to join ${[...ids]}`))
          } catch (_) { } // Ignore, the lobby will handle this
          break

        case State.SYNCING:
          const { to, content } = getSyncBuffer(data)

          if (to == client.id)
            throw Error(`${client.id}> attempted sending data to themself`)

          if (!this.clients.has(to))
            throw Error(`${client.id}> attempted sending data to non exsistent client ${to}`)

          content.setUint16(0, client.id, true) // override who this content is for
          for (const [id, { send }] of this.clients)
            if (id == to)
              send(content.buffer)
          break
      }
  }

  private async bindState(client: Client) {
    // Remove client once it is dead so it can be GC'd.
    for await (const state of client.stateChange)
      if (state == State.DEAD)
        return this.ready.deactivate(new LeaveError(client.id, `${client.id} disconnected while in potential group with ${[...this.clients.keys()]}`))
  }
}
