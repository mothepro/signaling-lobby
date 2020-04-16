import { TextEncoder } from 'util'
import WebSocket, { AddressInfo } from 'ws'
import { LobbyID, ClientID } from '../src/messages'
import createServer from '../src/createServer'

const encoder = new TextEncoder

export function buildIntro(lobby: LobbyID, name: string) {
  const buf = new DataView(new ArrayBuffer(4 + name.length))
  buf.setInt32(0, lobby, true)
  new Uint8Array(buf.buffer, 4).set(encoder.encode(name))
  return buf.buffer
}

export function buildProposal(approve: boolean, ...ids: ClientID[]) {
  const buf = new DataView(new ArrayBuffer(1 + 2 * ids.length))
  buf.setInt8(0, +approve)
  new Uint16Array(buf.buffer, 1).set(ids)
  return buf.buffer
}

export const makeClient = (server: ReturnType<typeof createServer>) =>
  new WebSocket(`ws://localhost:${(server.address() as AddressInfo).port}`)
