import * as WebSocket from 'ws'
import { SafeEmitter, Emitter, SafeSingleEmitter } from 'fancy-emitter'
import { Name, LobbyID, getIntro, Intro, Proposal, getProposal, SyncBuffer, getSyncBuffer } from './messages'
import logger, { Level } from '../util/logger'

export const enum State {
  /** Client that has just successfully initiated a connection. */
  ONLINE,

  /**
   * Client that has just connected and we can communicate with them.
   * Should only send an `Intro`.
   */
  CONNECTED,

  /**
   * Client is in the lobby with a name assigned.
   * Should only send a `Proposal` as start group / confirmation or a `Reject`.
   */
  IN_LOBBY,

  /**
   * Group established.
   * Should only send a `offer` & `answer` to sync SDPs.
   */
  SYNCING,

  /**
   * The underlying socket is either closing or closed.
   * This Client is ready to be cleaned up.
   */
  DEAD,
}

export default class {
  /** Handle to kill this client after timeout. */
  private timeout = setTimeout(() => this.stateChange.activate(State.DEAD), this.idleTimeout)

  /** Current state of connection. */
  state = State.ONLINE

  /** Name given by the client. */
  name?: Name

  /** Lobby the client is a part of. */
  lobby?: LobbyID

  /** Activated when changing state. */
  readonly stateChange: Emitter<State> = new Emitter

  /** Activated when the client sends an intro to the server. */
  readonly intro = new SafeSingleEmitter<Intro>(({ name, lobby }) => {
    this.name = name.substr(0, this.maxNameLength)
    this.lobby = lobby
    this.stateChange.activate(State.IN_LOBBY)
  })

  /** Activated when the client sends a group proposal to the server. */
  readonly proposal = new SafeEmitter<Proposal>()

  /** Activated when the client sends data after syncing to the server. */
  readonly message = new SafeEmitter<SyncBuffer>()

  /** Activated when the client talks to the server. */
  private readonly incoming: SafeEmitter<WebSocket.Data> = new SafeEmitter(data => {
    logger(Level.TRANSFER, this.id, '>', data)
    try {
      switch (this.state) {
        case State.CONNECTED:
          this.intro.activate(getIntro(data))
          break
        
        case State.IN_LOBBY:
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
  })

  constructor(
    /** An ID that is unique to this client. */
    readonly id: number,
    readonly socket: WebSocket,
    private readonly maxNameLength: number,
    /** ms to wait before to kill this client if they are not grouped. */
    private readonly idleTimeout: number,
    private readonly syncTimeout: number,
  ) {
    socket.binaryType = 'arraybuffer'
    socket.on('open', () => this.stateChange.activate(State.CONNECTED))
    socket.on('close', () => this.stateChange.activate(State.DEAD))
    socket.on('error', this.stateChange.deactivate)
    socket.on('message', this.incoming.activate)

    // Already opened, lets activate on the next tick to allow async listeners to be bound
    if (socket.readyState == socket.OPEN)
      setImmediate(() => this.stateChange.activate(State.CONNECTED))

    // Handle state changes
    this.stateChange.on(newState => {
      // if (newState == this.state) this.failure(Error(`state activated but stayed as ${this.state}`)),
      logger(Level.DEBUG, this.id, '> changed state', this.state, '->', newState)
      switch (this.state = newState) {
        case State.DEAD:
          this.stateChange.cancel()
          // TODO close all other emitters to safe resources?
          this.socket.close()
        // fall-thru

        case State.SYNCING:
          clearTimeout(this.timeout)

          if (this.state != State.DEAD) // why aren't switch statements better... smh
            this.timeout = setTimeout(() => this.stateChange.activate(State.DEAD), this.syncTimeout)
      }
    }).catch((err: Error) => logger(Level.USEFUL, this.id, '>', err) && this.socket.terminate())
  }

  send = async (message: ArrayBuffer | SharedArrayBuffer) =>
    (this.state == State.CONNECTED || this.state == State.IN_LOBBY || this.state == State.SYNCING)
    && logger(Level.TRANSFER, this.id, '<', message)
    && new Promise(resolve => this.socket.send(message, {}, resolve))
}
