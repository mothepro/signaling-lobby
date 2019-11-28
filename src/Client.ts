
import * as WebSocket from 'ws'
import { SafeEmitter } from 'fancy-emitter'
import { getIntro, getId, Name, LobbyID, ClientID, clientToBuffer } from './messages'

export const enum State {
  /** A Client that has just initiated a connection. */
  CONNECTING,

  /** A Client that has just connected and we can communicate with them. */
  CONNECTED,

  /** A Client ready in the lobby with a name assigned. */
  LOBBY_READY,

  /** A Client waiting in the lobby with a name assigned. */
  WAITING,

  /** 
   * A Client is in a group with at least another client.
   * 
   * If they have not reached this state by `idleTimeout`
   * than the connection will be closed and they will be
   * removed from the server.
   */
  GROUPED,

  /**
   * The underlying socket is either closing or closed.
   * This Client is ready to be cleaned up.
   */
  DEAD,
}

export default class {
  /** Handle to kill this client after timeout. */
  private timeout: NodeJS.Timeout

  /** Current state of connection. */
  private state = State.CONNECTING

  /** Name given by the client. */
  name?: Name

  /** Lobby the client is a part of. */
  lobby?: LobbyID

  /** Activated when changing state. */
  readonly stateChange: SafeEmitter<State> = new SafeEmitter

  /** Activated when client wants another client in their group. */
  readonly message: SafeEmitter<ClientID> = new SafeEmitter

  constructor(
    /** An ID that is unique to this client. */
    readonly id: number,
    private readonly socket: WebSocket,
    private readonly maxNameLength: number,
    /** ms to wait before to kill this client if they are not grouped. */
    idleTimeout: number,
    private readonly log: Function,
  ) {
    this.id = id & 0xFFFF // it must the size of a ClientID
    socket.binaryType = 'arraybuffer'
    socket.on('open', this.opened)
    socket.on('close', this.closed)
    socket.on('error', this.failure)
    socket.on('message', this.messageReceived)

    // Already opened
    if (socket.readyState == socket.OPEN)
      this.opened()

    // Set timer if state doesn't change
    this.timeout = setTimeout(() => this.socket.close(), idleTimeout) 
    this.bindStateChange(idleTimeout)
  }

  send = async (data: ArrayBuffer) =>
    new Promise(resolve => this.socket.send(data, {}, resolve))

  // Since this can't be in the constructor
  private async bindStateChange(ms: number) {
    for await (const newState of this.stateChange)
      switch (this.state = newState) {
        // We can stop the timer now
        case State.GROUPED:
        case State.DEAD:
          if (this.timeout)
            clearTimeout(this.timeout)
          break

        // Set the timer if it isn't set already.
        default:
          if (!this.timeout)
            this.timeout = setTimeout(() => this.socket.close(), ms)
      }
  }

  private opened = () =>
    this.stateChange.activate(State.CONNECTED)
    && this.log('Opened a connection with', this.id)

  private closed = () =>
    this.state != State.DEAD // if hasn't been closed already
    && this.stateChange.activate(State.DEAD)
    && this.log('Closed a connection with', this.id)

  private failure = (err: Error) => {
    this.log('An error occurred with a connection', this.id, err)
    this.socket.terminate()
    this.closed()
  }

  private messageReceived = (data: WebSocket.Data) => {
    try {
      switch (this.state) {
        // An introduction from the client
        case State.CONNECTING: // That's weird
        case State.CONNECTED:
          const { name, lobby } = getIntro(data)
          this.name = name.substr(0, this.maxNameLength)
          this.lobby = lobby
          this.stateChange.activate(State.LOBBY_READY).activate(State.WAITING)
          this.log('Connection with', this.id, 'established in lobby', this.lobby, 'as', this.name)
          return

        // ID of the peer we want to include in the group
        case State.WAITING:
        case State.GROUPED:
          this.message.activate(getId(data))
          return
      }
      throw Error(`While in State ${this.state}, received an unexpected message ${data}`)
    } catch (err) {
      this.failure(err)
    }
  }
}
