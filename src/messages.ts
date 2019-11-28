import { Data } from 'ws'
import { TextDecoder, TextEncoder } from 'util'
import Client from './Client'

export type Name = string
/** Uint32 (4 bytes) to represent the ID of a lobby. */
export type LobbyID = number
/** Uint16 (2 bytes) to represent the ID of a client. */
export type ClientID = number

const decode = new TextDecoder().decode

const encode = new TextEncoder().encode

export function getIntro(input: Data): { name: string, lobby: number } {
  if (input instanceof ArrayBuffer)
    return {
      lobby: new Uint32Array(input, 0, 1)[0],
      name: decode(input.slice(4)),
    }
  throw TypeError(`Expected Introduction but  got ${input}`)
}

export function getId(input: Data): ClientID {
  if (input instanceof ArrayBuffer && input.byteLength == 2)
    return new Uint16Array(input)[0]
  throw TypeError(`Expected ID but got ${input}`)
}

export function clientToBuffer(client: Client): ArrayBuffer {
  const { id, name } = client,
    ret = new Uint16Array(2 + Buffer.byteLength(name!, 'utf-8'))
  ret.set([id])
  ret.set(encode(name), 1)
  return ret.buffer
}
