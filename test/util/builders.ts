import { TextEncoder } from 'util'
import { LobbyID, ClientID } from '../../src/messages'
import { Size } from '../../src/util/constants'

export const encoder = new TextEncoder

export function buildIntro(lobby: LobbyID, name: string) {
  const buf = new DataView(new ArrayBuffer(Size.INT + name.length))
  buf.setInt32(0, lobby, true)
  new Uint8Array(buf.buffer, Size.INT).set(encoder.encode(name))
  return buf.buffer
}

export function buildProposal(approve: boolean, ...ids: ClientID[]) {
  const buf = new DataView(new ArrayBuffer(Size.CHAR + Size.SHORT * ids.length))
  buf.setInt8(0, +approve)
  new Uint16Array(buf.buffer, Size.CHAR).set(ids)
  return buf.buffer
}
