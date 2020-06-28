import { SingleEmitter } from 'fancy-emitter'
import { groupJoin, groupLeave, groupFinal } from './outgoing'
import Client, { State } from './Client'
import logger, { Level } from '../util/logger'
import { Max, ClientID } from '../util/constants'

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

  private readonly ready = new SingleEmitter(() => {
    logger(Level.INFO, ...this.clients.keys(), 'have finalized a group')
    for (const [id, { send, stateChange }] of this.clients) {
      stateChange.activate(State.SYNCING)
      // Browser doesn't know their own id, but we give it to them first as a comparator.
      send(groupFinal(this.code, id, ...this.idsWithout(id)))
    }
  })

  /** All the client IDs in this group without `ids`. */
  private idsWithout(...ids: ClientID[]) {
    const all = new Set(this.clients.keys())
    for (const id of ids)
      all.delete(id)
    return all
  }

  private ack(ackerId: ClientID) {
    this.acks.add(ackerId)
    logger(Level.DEBUG, ackerId, '> joining group of', ...this.clients.keys(), 'so far', this.acks, 'have agreed')

    // Everyone is in!
    if (this.acks.size == this.clients.size)
      this.ready.activate()
    else
      for (const [id, { send }] of this.clients)
        if (id != ackerId)
          // ackr will go first & browser doesn't know their own id
          send(groupJoin(ackerId, ...this.idsWithout(ackerId, id)))
  }

  /** Create and clean up a group once it is no longer needed. */
  private constructor(initiator: Client, ...clients: Client[]) {
    this.clients.set(initiator.id, initiator)
    for (const client of clients)
      this.clients.set(client.id, client)

    // This must be done since async isn't allowed in constructor & binds can't "overlap".
    for (const [, client] of this.clients) {
      this.bindState(client)
      this.bindProposal(client)
      this.bindMessage(client)
    }

    logger(Level.DEBUG, initiator.id, '> proposed group to include', ...this.clients.keys())
    this.ack(initiator.id)

    // Notify all other clients when a group fails.
    this.ready.event
      .catch((e: LeaveError) => {
        for (const [id, { send }] of this.clients)
          if (id != e.id)
            // ackr will go first & browser doesn't know their own id
            send(groupLeave(e.id, ...this.idsWithout(e.id, id)))
      })
      .finally(() => Group.groups.delete(Group.hashIds(...this.clients.keys())))
  }

  private async bindProposal(client: Client) {
    for await (const { approve, ids } of client.proposal) {
      // Only handle if group belongs to us, and only us
      if (ids.size + 1 == this.clients.size // Same number of ids in our group (`ids` doesn't contain self)
        && ![...ids].filter(id => !this.clients.has(id)).length) // this.clients has every one of `ids`
        if (approve)
          this.ack(client.id)
        else
          this.ready.deactivate(new LeaveError(client.id, `${client.id} doesn't want to join ${[...ids]}`))
    }
  }

  private async bindMessage(client: Client) {
    try {
      for await (const { to, content } of client.message) {
        // broadcast to "self" means to actually broadcast all group members (excluding self) if group is activated
        if (to == client.id && !client.stateChange.isAlive) {
          for (const [id, { send }] of this.clients)
            if (to != id)
              send(content.buffer)
        } else { // transform the `to` into a `from` and ship it to the `from` client
          content.setUint16(0, client.id, true)
          this.clients.get(to)?.send(content.buffer)
        }
      }
    } catch (err) {
      client.stateChange.deactivate(err)
    }
  }

  private async bindState(client: Client) {
    try { // Idle until client is dead so it can be GC'd.
      for await (const _ of client.stateChange);
    } catch { } // Handled in Client's constructor
    this.ready.deactivate(new LeaveError(client.id, `${client.id} disconnected while in potential group with ${[...this.clients.keys()]}`))
  }
}
