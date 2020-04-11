import { Data } from 'ws'
import stringSantizer from './stringSantizer'

export type Name = string

/** Int32 (4 bytes) to represent the ID of a lobby. */
export type LobbyID = number

/** Uint16 (2 bytes) to represent the ID of a client. */
export type ClientID = number

/** Tell the server to add me to lobby with other potential clients. */
export type Intro = {
  /** Name to use as client. */
  name: Name

  /** ID of lobby to join */
  lobby: LobbyID
}

export function getIntro(input: Data): { name: Name, lobby: LobbyID } {
  if (input instanceof Buffer) // Array buffers are converted :(
    return {
      lobby: input.readInt32LE(0),
      name: stringSantizer(input.toString('utf-8', 4)),
    }
  throw TypeError(`Expected Introduction but got '${input}'`)
}

/** Update a group proposal. */
export type Proposal = {
  /** True to accept or create, False to reject. */
  approve: boolean

  /** Other clients to include in group. */
  ids: Set<ClientID>
}

export function getProposal(input: Data): Proposal {
  if (input instanceof Buffer && input.byteLength >= 3 && input.byteLength % 2 == 1) {
    // Casting to a UInt16Array doesn't work due to `ws` prepending some values
    const ids: Set<ClientID> = new Set
    for (let offset = 1; offset < input.byteLength; offset += 2)
      ids.add(input.readUInt16LE(offset))

    return {
      ids,
      approve: !!input.readUInt8(0),
    }
  }
  throw TypeError(`Expected ID but got '${input}'`)
}
