import * as WebSocket from 'ws'
import { SafeEmitter } from 'fancy-emitter'
import { Name, LobbyID, getIntro } from './messages'
import logger, { Level } from './util/logger'

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
  private timeout = setTimeout(() => this.socket.close(), this.idleTimeout)

  /** Current state of connection. */
  state = State.ONLINE

  /** Name given by the client. */
  name?: Name

  /** Lobby the client is a part of. */
  lobby?: LobbyID

  /** Activated when changing state. */
  readonly stateChange: SafeEmitter<State> = new SafeEmitter(
    newState => logger(Level.DEBUG, this.id, '> changed state', this.state, '->', newState),
    newState => newState == this.state && this.failure(Error(`state activated but stayed as ${this.state}`)),
    newState => this.state = newState, // actually update
    () => (this.state == State.DEAD || this.state == State.SYNCING) && clearTimeout(this.timeout))

  /** Activated when the client talks to the server. */
  readonly message: SafeEmitter<WebSocket.Data> = new SafeEmitter(
    data => logger(Level.DEBUG, this.id, '> sent', data),
    data => {
      if (this.state == State.CONNECTED)
        try {
          // An introduction from the client
          const { name, lobby } = getIntro(data)
          this.name = name.substr(0, this.maxNameLength)
          this.lobby = lobby
          this.stateChange.activate(State.IN_LOBBY)
        } catch (err) {
          this.failure(err)
        }
    })

  constructor(
    /** An ID that is unique to this client. */
    readonly id: number,
    private readonly socket: WebSocket,
    private readonly maxNameLength: number,
    /** ms to wait before to kill this client if they are not grouped. */
    private readonly idleTimeout: number,
  ) {
    socket.on('open', () => this.stateChange.activate(State.CONNECTED))
    socket.on('close', () => this.stateChange.activate(State.DEAD))
    socket.on('error', this.failure)
    socket.on('message', this.message.activate)

    // Already opened
    if (socket.readyState == socket.OPEN)
      this.stateChange.activate(State.CONNECTED)
  }

  send = async (message: ArrayBuffer | SharedArrayBuffer) =>
    logger(Level.DEBUG, this.id, '< receiving', message)
    && new Promise(resolve => this.socket.send(message, {}, resolve))

  failure = (err: Error) =>
    logger(Level.SEVERE, 'An error occurred with connection', this.id, err)
    && this.socket.terminate()
}
