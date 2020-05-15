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
}

export default class {
  /** Current state of connection. */
  state = State.ONLINE

  /** Name given by the client. */
  name?: Name

  /** Lobby the client is a part of. */
  lobby?: LobbyID

  /** Activated when changing state. */
  readonly stateChange: Emitter<State> = new Emitter

  /** Handle to kill this client after timeout. */
  private timeout = setTimeout(this.stateChange.cancel, this.idleTimeout)

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
    else
      this.stateChange.deactivate(Error(`${this.id} attempted to send ${size} bytes, expected between 1 & ${this.maxPacketSize} bytes`))
  })

  readonly send = async (message: ArrayBuffer | SharedArrayBuffer) =>
    (this.state == State.CONNECTED || this.state == State.IN_LOBBY || this.state == State.SYNCING)
    && logger(Level.TRANSFER, this.id, '<', message)
    && new Promise(resolve => this.socket.send(message, {}, resolve))

  constructor(
    /** An ID that is unique to this client. */
    readonly id: number,
    readonly socket: WebSocket,
    private readonly maxPacketSize: number,
    private readonly maxNameLength: number,
    /** ms to wait before to kill this client if they are not grouped. */
    private readonly idleTimeout: number,
    private readonly syncTimeout: number,
  ) {
    socket.binaryType = 'arraybuffer'
    socket.on('open', () => this.stateChange.activate(State.CONNECTED))
    socket.on('close', this.stateChange.cancel)
    socket.on('error', this.stateChange.deactivate)
    socket.on('message', this.incoming.activate)

    // Already opened, lets activate on the next tick to allow async listeners to be bound
    if (socket.readyState == socket.OPEN)
      setImmediate(() => this.stateChange.activate(State.CONNECTED))

    // Async not allowed in constructor
    this.bindState()
  }

  private async bindState() {
    try {
      for await (const state of this.stateChange) {
        logger(Level.DEBUG, this.id, '> changed state', this.state, '->', state)
        this.state = state
        if (state == State.SYNCING) {
          clearTimeout(this.timeout)
          this.timeout = setTimeout(this.stateChange.cancel, this.syncTimeout)
        }
      }

      // TODO close all other emitters to safe resources?
      clearTimeout(this.timeout)
      this.socket.close()
    } catch (err) {
      logger(Level.USEFUL, this.id, '>', err)
      this.socket.terminate()
    }
  }
}
