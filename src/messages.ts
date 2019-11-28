import { Data } from 'ws'
import { TextDecoder } from 'util'

export type Name = string
export type LobbyID = number // unint32 (4 bytes)
export type ClientID = number // unint16 (2 bytes)

const decode = new TextDecoder().decode

export const getIntro = (input: Data): { name: string, lobby: number } => {
  if (input instanceof ArrayBuffer)
    return {
      lobby: new Uint32Array(input, 0, 1)[0],
      name: decode(input.slice(4)),
    }
  throw TypeError(`Expected Introduction but  got ${input}`)
}

export const getId = (input: Data): ClientID => {
  if (input instanceof ArrayBuffer && input.byteLength == 2)
    return new Uint16Array(input)[0]
  throw TypeError(`Expected ID but got ${input}`)
}
