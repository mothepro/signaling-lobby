import { Data } from 'ws'
import { TextDecoder, TextEncoder } from 'util'
import Client from './Client'
import stringSantizer from './stringSantizer'

export type Name = string
/** Uint32 (4 bytes) to represent the ID of a lobby. */
export type LobbyID = number
/** Uint16 (2 bytes) to represent the ID of a client. */
export type ClientID = number

const encoder = new TextEncoder
const decoder = new TextDecoder
const toUtf8 = (buffer: ArrayBuffer, offset: number) =>
  stringSantizer(decoder.decode(buffer.slice(offset)))
const toArrayBuffer = (str: string) =>
  encoder.encode(str)

export function getIntro(input: Data): { name: Name, lobby: LobbyID } {
  if (input instanceof ArrayBuffer) // Array buffers are converted :(
    return {
      lobby: new DataView(input).getUint32(0),
      name: toUtf8(input, 4),
    }
  throw TypeError(`Expected Introduction but got '${input}'`)
}

export function getId(input: Data): ClientID {
  if (input instanceof ArrayBuffer && input.byteLength == 2)
    return new Uint16Array(input)[0]
  throw TypeError(`Expected ID but got '${input}'`)
}

export function clientToBuffer(client: Client): ArrayBuffer {
  const ret = new Uint16Array(2 + Buffer.byteLength(client.name!, 'utf-8'))
  ret.set([client.id])
  ret.set(toArrayBuffer(client.name!), 1)
  return ret.buffer
}
