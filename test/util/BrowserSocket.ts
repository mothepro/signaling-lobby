import { Server } from 'http'
import { SafeSingleEmitter, SingleEmitter, SafeEmitter } from 'fancy-emitter'
import WebSocket, { Data, AddressInfo } from 'ws'
import { TextEncoder } from 'util'
import { Size } from '../../util/constants'
import { ClientID, Name, LobbyID, Code } from '../../src/messages'

export const encoder = new TextEncoder

/** Gets list of `ClientID`s from a buffer at an offset. */
// Buffer -> UInt16Array is not WAI. Do not rely on the underlying ArrayBuffer `data.buffer`
function getClientIDs(data: Buffer, offset = 0): ClientID[] {
  const ids = []
  for (let i = offset; i < data.byteLength; i += Size.SHORT)
    ids.push(data.readUInt16LE(i))
  return ids
}

export default class {
  private socket: WebSocket

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
            && data.byteLength % Size.SHORT == Size.CHAR) {
            this.groupChange.activate({
              approval: data.readInt8(0) == Code.GROUP_REQUEST,
              ids: getClientIDs(data, Size.CHAR),
            })
          }
          break

        case Code.GROUP_FINAL:
          if (data.byteLength >= Size.CHAR + Size.INT
            && data.byteLength % Size.SHORT == Size.CHAR) {
            this.groupFinal.activate({
              code: data.readUInt32LE(Size.CHAR),
              ids: getClientIDs(data, Size.CHAR + Size.INT),
            })
          }
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
    code: number
  }>()

  constructor(server: Server) {
    this.socket = new WebSocket(`ws://localhost:${(server.address()! as AddressInfo).port}`)
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

  /** Helper to send an intro */
  sendIntro(lobby: LobbyID, name: string) {
    const nameBuffer = encoder.encode(name),
      buf = new DataView(new ArrayBuffer(Size.INT + nameBuffer.byteLength))
    buf.setInt32(0, lobby, true)
    new Uint8Array(buf.buffer, Size.INT).set(nameBuffer)
    this.send(buf.buffer)
  }

  /** Helper to send a group proposal */
  sendProposal(approve: boolean, ...ids: ClientID[]) {
    const buf = new DataView(new ArrayBuffer(Size.CHAR + Size.SHORT * ids.length))
    buf.setInt8(0, +approve)
    new Uint8Array(buf.buffer, Size.CHAR).set(new Uint16Array(ids))
    this.send(buf.buffer)
  }


  get readyState() { return this.socket.readyState }
}
