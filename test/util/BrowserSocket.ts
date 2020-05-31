import { Server } from 'http'
import { SafeSingleEmitter, SingleEmitter, SafeEmitter } from 'fancy-emitter'
import WebSocket, { Data, AddressInfo } from 'ws'
import { TextEncoder } from 'util'
import { Size, ClientID, Name, LobbyID, Code } from '../../util/constants'

export const encoder = new TextEncoder

/** Gets list of `ClientID`s from a buffer at an offset. */
// Buffer -> UInt16Array is not WAI. Do not rely on the underlying ArrayBuffer `data.buffer`
function getClientIDs(data: Buffer, offset = 0): ClientID[] {
  const ids = []
  for (let i = offset; i < data.byteLength; i += Size.SHORT)
    ids.push(data.readUInt16LE(i))
  return ids
}

/** A Mock for a client connecting to the server with a browser. */
export default class {
  private socket: WebSocket

  get readyState() { return this.socket.readyState }

  readonly open = new SafeSingleEmitter
  readonly close = new SingleEmitter
  readonly message = new SafeEmitter<Data>(data => {
    if (data instanceof Buffer)
      switch (data.readUInt8(0)) {
        case Code.CLIENT_JOIN:
          if (data.byteLength > Size.CHAR + Size.SHORT)
            this.clientPresence.activate({
              join: true,
              id: data.readUInt16LE(Size.CHAR),
              name: data.toString('utf-8', Size.CHAR + Size.SHORT)
            })
          break

        case Code.CLIENT_LEAVE:
          if (data.byteLength == Size.CHAR + Size.SHORT)
            this.clientPresence.activate({
              join: false,
              id: data.readUInt16LE(Size.CHAR),
            })
          break

        case Code.GROUP_REJECT:
        case Code.GROUP_REQUEST:
          if (data.byteLength >= Size.CHAR + Size.SHORT
            && data.byteLength % Size.SHORT == Size.CHAR)
            this.groupChange.activate({
              approval: data.readInt8(0) == Code.GROUP_REQUEST,
              ids: getClientIDs(data, Size.CHAR),
            })
          break

        case Code.GROUP_FINAL:
          if (data.byteLength >= Size.CHAR + Size.INT
            && data.byteLength % Size.SHORT == Size.CHAR)
            this.groupFinal.activate({
              code: data.readUInt32LE(Size.CHAR),
              cmp: data.readUInt16LE(Size.CHAR + Size.INT),
              ids: getClientIDs(data, Size.CHAR + Size.SHORT + Size.INT),
            })
          break
      }
  })

  /** Activated when a client join/leave message is received. */
  readonly clientPresence = new SafeEmitter<{
    join: boolean
    id: ClientID
    name?: Name
  }>()

  /** Activated when a group proposal/ack/reject message is received. */
  readonly groupChange = new SafeEmitter<{
    approval: boolean
    ids: ClientID[]
  }>()

  /** Activated when a group finalization message is received. */
  readonly groupFinal = new SafeEmitter<{
    ids: ClientID[]
    cmp: ClientID
    code: number
  }>()

  constructor(server: Server, lobby: LobbyID, name: Name) {
    this.socket = new WebSocket(`ws://localhost:${(server.address()! as AddressInfo).port}?name=${encodeURIComponent(name)}&lobby=${encodeURIComponent(lobby)}`)
    this.socket.once('open', this.open.activate)
    this.socket.once('close', this.close.activate)
    this.socket.once('error', this.close.deactivate)
    this.socket.on('message', this.message.activate)
    this.close.event.catch(err => {
      if (err.code != 'ECONNRESET') // Swallow 'hang ups' due to server disconnection
        throw err
    })
  }

  readonly exit = () => this.socket.close()
  readonly send = (data: ArrayBuffer) => this.socket.send(data)

  /** Helper to send a group proposal */
  sendProposal(approve: boolean, ...ids: ClientID[]) {
    const buf = new DataView(new ArrayBuffer(Size.CHAR + Size.SHORT * ids.length))
    buf.setInt8(0, +approve)
    for (let i = 0; i < ids.length; i++)
      buf.setUint16(Size.CHAR + i * Size.SHORT, ids[i], true)
    this.send(buf.buffer)
  }
}
