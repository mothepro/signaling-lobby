import WebSocket from 'ws'
import Server from '../../src/Server'
import { SafeSingleEmitter, SingleEmitter, SafeEmitter } from 'fancy-emitter'

export default class {
  private socket: WebSocket

  readonly open = new SafeSingleEmitter
  readonly close = new SingleEmitter
  readonly message = new SafeEmitter<WebSocket.Data>()

  constructor(server: Server) {
    this.socket = new WebSocket(`ws://localhost:${server.address.port}`)
    this.socket.once('open', this.open.activate)
    this.socket.once('close', this.close.activate)
    this.socket.once('error', this.close.deactivate)
    this.socket.on('message', this.message.activate)
  }

  readonly send = (data: ArrayBuffer) => this.socket.send(data)
  readonly exit = () => this.socket.close()

  get readyState() { return this.socket.readyState }
}
