import WebSocket, { Data } from 'ws'
import { SafeSingleEmitter, SingleEmitter, SafeEmitter } from 'fancy-emitter'
import Server from '../../src/Server'
import { Size } from '../../src/util/constants'
import { ClientID, Name } from '../../src/messages'

// Should match code's sent from server to browsers
const enum Code {
  CLIENT_LEAVE,
  CLIENT_JOIN,
  GROUP_REQUEST,
  GROUP_REJECT,
}

export default class {
  private socket: WebSocket

  readonly open = new SafeSingleEmitter
  readonly close = new SingleEmitter
  readonly message = new SafeEmitter<Data>(data => {
    if (data instanceof Buffer)
      switch (data.readUInt8(0)) {
        case Code.CLIENT_LEAVE:
        case Code.CLIENT_JOIN:
          if (data.byteLength >= Size.CHAR + Size.SHORT + 1)
            this.clientPresence.activate({
              join: !!data.readInt8(0),
              id: data.readUInt16LE(Size.CHAR),
              name: data.toString('utf-8', Size.CHAR + Size.SHORT)
            })
          break

        case Code.GROUP_REJECT:
        case Code.GROUP_REQUEST:
          if (data.byteLength >= Size.CHAR + Size.SHORT
            && data.byteLength % Size.SHORT == Size.CHAR) {
            // Buffer -> UInt16Array is not WAI. Do not rely on the underlying ArrayBuffer `data.buffer`
            const ids = []
            for (let offset = Size.CHAR; offset < data.byteLength; offset += Size.SHORT)
              ids.push(data.readUInt16LE(offset))
            this.groupChange.activate({ ids, approval: !!data.readInt8(0) })
          }
          break

      }
  })

  /** Activated when a client join/leave message is received. */
  readonly clientPresence = new SafeEmitter<{
    join: boolean
    id: ClientID
    name: Name
  }>()

  /** Activated when a group proposal/ack/reject message is received. */
  readonly groupChange = new SafeEmitter<{
    approval: boolean
    ids: ClientID[]
  }>()

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
