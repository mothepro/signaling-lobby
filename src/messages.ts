import { Data } from 'ws'
import { TextDecoder, TextEncoder } from 'util'
import Client from './Client'
import stringSantizer from './stringSantizer'

export type Name = string
/** Uint32 (4 bytes) to represent the ID of a lobby. */
export type LobbyID = number
/** Uint16 (2 bytes) to represent the ID of a client. */
export type ClientID = number

export function getIntro(input: Data): { name: Name, lobby: LobbyID } {
  if (input instanceof Buffer) // Array buffers are converted :(
    return {
      lobby: input.readInt32LE(0),
      name: stringSantizer(input.toString('utf-8', 4)),
    }
  console.log(input, typeof input, input instanceof ArrayBuffer)
  throw TypeError(`Expected Introduction but got '${input}'`)
}

export function getId(input: Data): ClientID {
  if (input instanceof ArrayBuffer && input.byteLength == 2)
    return new Uint16Array(input)[0]
  throw TypeError(`Expected ID but got '${input}'`)
}

export function clientToBuffer(client: Client): Buffer {
  const ret = Buffer.allocUnsafe(2 + client.name!.length)
  ret.writeInt16LE(client.id!, 0)
  ret.write(client.name!, 2)
  return ret
}
