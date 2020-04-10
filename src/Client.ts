
import * as WebSocket from 'ws'
import { SafeEmitter } from 'fancy-emitter'
import { getIntro, getId, Name, LobbyID, ClientID, clientToBuffer } from './util/messages'
import logger, { Level } from './util/logger'

export const enum State {
  /** A Client that has just initiated a connection. */
  ONLINE,

  /** A Client that has just connected and we can communicate with them. */
  CONNECTED,

  /** A Client ready in the lobby with a name assigned. */
  IDLE,

  /**
   * The underlying socket is either closing or closed.
   * This Client is ready to be cleaned up.
   */
  DEAD,
}

export default class {
  /** Handle to kill this client after timeout. */
  private timeout: NodeJS.Timeout = setTimeout(() => this.socket.close(), this.idleTimeout)

  /** Current state of connection. */
  private state = State.ONLINE

  /** Name given by the client. */
  name?: Name

  /** Lobby the client is a part of. */
  lobby?: LobbyID

  /** Activated when changing state. */
  readonly stateChange: SafeEmitter<State> = new SafeEmitter(
    newState => logger(Level.DEBUG, this.id, '> changed state', this.state, '->', newState),
    newState => {
      if (newState != this.state)
        switch (this.state = newState) {
          case State.CONNECTED:
            logger(Level.INFO, this.id, '> opened a connection')
            break

          // We can stop the timer now
          case State.DEAD:
            logger(Level.INFO, this.id, '> closed a connection')
            clearTimeout(this.timeout)
            delete this.timeout
            break

          case State.IDLE:
            logger(Level.INFO, this.id, '> joined lobby', this.lobby, 'as', this.name)
            break
        }
      else
        logger(Level.SEVERE, this.id, '> state activated but stayed as', this.state)
    })

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
          this.stateChange.activate(State.IDLE)
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

  send = async (data: WebSocket.Data) =>
    new Promise(resolve => this.socket.send(data, {}, resolve))

  private failure = (err: Error) =>
    logger(Level.SEVERE, 'An error occurred with connection', this.id, err)
    && this.stateChange.activate(State.DEAD)
    && this.socket.terminate()
}
