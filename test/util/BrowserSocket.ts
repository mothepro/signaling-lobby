import { Server } from 'http'
import { SafeEmitter } from 'fancy-emitter'
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

  readonly open: Promise<void>
  readonly close: Promise<void>
  connected = false
  readonly message = new SafeEmitter<Data>(data => {
    if (data instanceof Buffer) {
      if (data.byteLength > Size.SHORT) // Might be a synced buffer
        this.buffers.activate({
          from: data.readUInt16LE(0),
          data: data.slice(Size.SHORT).toString(),
        })

      switch (data.readUInt8(0)) {
        case Code.YOUR_NAME:
          this.yourName.activate(data.toString('utf-8', Size.CHAR))
          break

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

  /** Activated when a buffer (after syncing) message is received. */
  readonly buffers = new SafeEmitter<{
    from: ClientID
    data: string
  }>()

  /** Activated when the server assigns a name for the client. */
  readonly yourName = new SafeEmitter<Name>()

  constructor(server: Server, lobby: LobbyID, name: Name) {
    this.socket = new WebSocket(`ws://localhost:${(server.address()! as AddressInfo).port}?name=${encodeURIComponent(name)}&lobby=${encodeURIComponent(lobby)}`)
    this.socket.on('message', this.message.activate)

    this.open = new Promise(ok => {
      this.socket.once('open', () => this.connected = true)
      this.socket.once('open', ok)
    })
    this.close = new Promise((resolve, reject) => {
      this.socket.once('close', () => this.connected = false)
      this.socket.once('close', resolve)
      this.socket.once('error', () => this.connected = false)
      this.socket.once('error', reject)
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

  /** Helper to send a buffer after syned */
  sendSyncBuffer(to: ClientID, data: string) {
    const buffer = encoder.encode(data),
      view = new DataView(new ArrayBuffer(Size.SHORT + buffer.byteLength))
    view.setUint16(0, to, true)
    new Uint8Array(view.buffer, Size.SHORT).set(buffer)
    this.send(view.buffer)
  }
}
