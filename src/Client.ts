
import * as WebSocket from 'ws'
import { SafeEmitter } from 'fancy-emitter'
import { getIntro, getId, Name, LobbyID, ClientID } from './messages'

export const enum State {
  /** A Client that has just initiated a connection. */
  CONNECTING,

  /** A Client that has just connected and we can communicate with them. */
  CONNECTED,

  /** A Client waiting in the lobby with a name assigned. */
  WAITING,

  /** 
   * A Client is in a group with at least another client.
   * 
   * If they have not reached this state by `groupTimeout`
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
  private name?: Name

  /** Lobby the client is a part of. */
  private lobby?: LobbyID

  /** Activated when changing state. */
  readonly stateChange: SafeEmitter<State> = new SafeEmitter

  /** Activated when client wants another client in their group. */
  readonly possibleGroupChange: SafeEmitter<ClientID> = new SafeEmitter

  constructor(
    /** An ID that is unique to this client. */
    readonly id: number,
    private readonly socket: WebSocket,
    /** ms to wait before to kill this client if they are not grouped. */
    groupTimeout: number,
    private readonly nameSantizer: (name: unknown) => Name,
    private readonly log: Function,
  ) {
    this.stateChange.on(newState => {
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
            this.timeout = setTimeout(socket.close, groupTimeout)
      }
    })
    this.timeout = setTimeout(socket.close, groupTimeout) // Set timer if state doesn't change
    socket.on('open', this.opened)
    socket.on('close', this.closed)
    socket.on('error', this.failure)
    socket.on('message', this.message)
  }

  private opened = () =>
    this.stateChange.activate(State.CONNECTED)
    && this.log('Opened a connection')

  private closed = () => {
    this.stateChange.activate(State.DEAD)
    this.log('Closed a connection')
  }

  private failure = (err: Error) => {
    this.socket.terminate()
    this.log('An error occurred with a connection to a client', err)
    this.closed()
  }

  private message = (data: WebSocket.Data) => {
    try {
      switch (this.state) {
        // An introduction from the client
        case State.CONNECTING: // That's weird
        case State.CONNECTED:
          const { name, lobby } = getIntro(data)
          this.name = this.nameSantizer(name)
          this.lobby = lobby
          this.stateChange.activate(State.WAITING)
          this.log('Connection established with', name)
          break

        // ID of the peer we want to include in the group
        case State.WAITING:
        case State.GROUPED:
          this.possibleGroupChange.activate(getId(data))
      }
      throw Error(`While in State ${this.state}, received an unexpected message ${data}`)
    } catch (err) {
      this.failure(err)
    }
  }
}
