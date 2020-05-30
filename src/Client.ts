import * as WebSocket from 'ws'
import { SafeEmitter, Emitter } from 'fancy-emitter'
import { Name, LobbyID, Proposal, getProposal, SyncBuffer, getSyncBuffer, ClientID, clientJoin, clientLeave } from './messages'
import logger, { Level, logErr } from '../util/logger'
import Group from './Group'

export const enum State {
  /** Client that has just successfully initiated a connection. */
  ONLINE,

  /**
   * Client is in the lobby with a name assigned.
   * Should only send a `Proposal` as start group / confirmation or a `Reject`.
   */
  CONNECTED,

  /**
   * Group established.
   * Should only send a `offer` & `answer` to sync SDPs.
   */
  SYNCING,
}

export default class Client {

  /** Map that points to all the Client.lobbies with clients still in it. */
  private static readonly lobbies: Map<LobbyID, Set<Client>> = new Map

  /** Current state of connection. */
  state = State.ONLINE

  /** Activated when changing state. */
  readonly stateChange: Emitter<State> = new Emitter

  /** Handle to kill this client after timeout. */
  private timeout = setTimeout(this.stateChange.cancel, this.idleTimeout)

  /** Activated when the client sends a group proposal to the server. */
  readonly proposal = new SafeEmitter<Proposal>()

  /** Activated when the client sends data after syncing to the server. */
  readonly message = new SafeEmitter<SyncBuffer>()

  /** Activated when the client talks to the server. */
  private readonly incoming: SafeEmitter<WebSocket.Data> = new SafeEmitter(data => {
    let size = 0
    if (typeof data == 'string' || Array.isArray(data))
      size = data.length
    if (Buffer.isBuffer(data) || data instanceof ArrayBuffer)
      size = data.byteLength

    if (0 < size && size < this.maxPacketSize)
      try {
        logger(Level.TRANSFER, this.id, '>', data)
        switch (this.state) {
          case State.CONNECTED:
            this.proposal.activate(getProposal(data))
            break

          case State.SYNCING:
            this.message.activate(getSyncBuffer(data))
            break

          default:
            throw Error(`${this.id} in state ${this.state} sent unexpected data ${data}`)
        }
      } catch (err) {
        this.stateChange.deactivate(err)
      }
    else
      this.stateChange.deactivate(Error(`${this.id} attempted to send ${size} bytes, expected between 1 & ${this.maxPacketSize} bytes`))
  })

  readonly send = async (message: ArrayBuffer | SharedArrayBuffer) =>
    (this.state == State.CONNECTED || this.state == State.SYNCING)
    && logger(Level.TRANSFER, this.id, '<', message)
    && new Promise(resolve => this.socket.send(message, {}, resolve))

  constructor(
    /** An ID that is unique to this client. */
    readonly id: number,
    /** Name given by the client. */
    readonly name: Name,
    /** Lobby the client is a part of. */
    readonly lobby: LobbyID,
    readonly socket: WebSocket,
    private readonly maxPacketSize: number,
    /** ms to wait before to kill this client if they are not grouped. */
    private readonly idleTimeout: number,
    private readonly syncTimeout: number,
    /** Conver an ID to Client (Used with incoming proposals) */
    private readonly getClientWithId: (id: ClientID) => Client | void,
  ) {
    socket.binaryType = 'arraybuffer'
    socket.on('open', () => this.stateChange.activate(State.CONNECTED))
    socket.on('close', this.stateChange.cancel)
    socket.on('error', this.stateChange.deactivate)
    socket.on('message', this.incoming.activate)

    // Already opened, lets activate on the next tick to allow async listeners to be bound
    if (socket.readyState == socket.OPEN)
      setImmediate(() => this.stateChange.activate(State.CONNECTED))

    // Add new client to lobby, make if doesn't exist
    if (!Client.lobbies.has(this.lobby)) {
      logger(Level.DEBUG, 'Creating lobby', this.lobby)
      Client.lobbies.set(this.lobby, new Set)
    }
    logger(Level.DEBUG, this.id, '> joined lobby', this.lobby, 'as', this.name)
    Client.lobbies.get(this.lobby)!.add(this)

    // Async not allowed in constructor
    this.bindState()
    this.bindProposals()
  }

  private async bindState() {
    try {
      for await (const state of this.stateChange) {
        logger(Level.DEBUG, this.id, '> changed state', this.state, '->', state)
        switch (this.state = state) {
          case State.CONNECTED:
            // Tell everyone else about me & tell me about everyone else
            for (const other of Client.lobbies.get(this.lobby)!)
              if (this != other) {
                other.send(clientJoin(this))
                this.send(clientJoin(other))
              }
            break

          case State.SYNCING:
            clearTimeout(this.timeout)
            this.timeout = setTimeout(this.stateChange.cancel, this.syncTimeout)
            this.removeSelfFromLobby()
            break
        }
      }

      // TODO close all other emitters to safe resources?
      clearTimeout(this.timeout)
      this.socket.close()
    } catch (err) {
      logErr(this.id, err)
      this.socket.terminate()
    }
    logger(Level.DEBUG, this.id, '> will no longer be updated')
    this.removeSelfFromLobby()
  }

  private async bindProposals() {
    for await (const { approve, ids } of this.proposal)
      if (approve) {
        const participants = []

        // TODO, make this a one liner
        for (const id of ids) {
          const client = this.getClientWithId(id)
          if (client && id != this.id)
            participants.push(client)
          else
            // TODO decide if client should be kicked for this
            logger(Level.WARN, this.id, '> tried to add some non-existent members to group', ids)
        }

        // TODO decide if client should be kicked for this
        if (!participants.length)
          logger(Level.WARN, this.id, '> Tried to make a group without members')

        Group.make(this, ...participants)
      }
  }

  private removeSelfFromLobby() {
    const members = Client.lobbies.get(this.lobby)

    if (members?.delete(this)) {
      // Notify for client leaving on the next tick. Allows dead clients to be removed first
      setImmediate(() => {
        for (const { send } of members)
          send(clientLeave(this))
      })

      if (!members.size) {
        logger(Level.DEBUG, 'Removing empty lobby', this.lobby)
        Client.lobbies.delete(this.lobby)
      }
    }
  }
}
