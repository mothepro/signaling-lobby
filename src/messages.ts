import { Data } from 'ws'
import { TextEncoder } from 'util'
import stringSantizer from './util/stringSantizer'
import Client from './Client'
import Group from './Group'

export type Name = string

/** Int32 (4 bytes) to represent the ID of a lobby. */
export type LobbyID = number

/** Uint16 (2 bytes) to represent the ID of a client. */
export type ClientID = number

/** Tell the server to add me to lobby with other potential clients. */
export interface Intro {
  /** Name to use as client. */
  name: Name

  /** ID of lobby to join */
  lobby: LobbyID
}

// TODO use a STATUS bit to determine data type
export function getIntro(input: Data): { name: Name, lobby: LobbyID } {
  if (input instanceof Buffer && input.byteLength > 4) // Array buffers are converted :(
    return {
      lobby: new DataView(input).getUint32(0),
      name: toUtf8(input, 4),
    }
  throw TypeError(`Expected Introduction but got '${input}'`)
}

/** Update a group proposal. */
export interface Proposal {
  /** True to accept or create, False to reject. */
  approve: boolean

  /** Other clients to include in group. */
  ids: Set<ClientID>
}

export function getProposal(input: Data): Proposal {
  if (input instanceof Buffer && input.byteLength >= 1 + 2 && input.byteLength % 2 == 1) {
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

// Data sent to the browsers

const encoder = new TextEncoder

enum Code {
  CLIENT_LEAVE,
  CLIENT_JOIN,
  GROUP_REQUEST,
  GROUP_REJECT,
}

function clientPresence(join: Code.CLIENT_LEAVE | Code.CLIENT_JOIN, {name, id}: Client) {
  const nameBuffer = encoder.encode(name),
    ret = new DataView(new ArrayBuffer(1 + 2 + nameBuffer.byteLength))
  ret.setUint8(0, join)
  ret.setUint16(1, id, true)
  new Uint8Array(ret.buffer, 3).set(nameBuffer)
  return ret.buffer
}

function groupChange(approval: Code.GROUP_REJECT | Code.GROUP_REQUEST, {clients}: Group) {
  const ret = new DataView(new ArrayBuffer(1 + clients.size * 2))
  ret.setUint8(0, approval)
  new Uint16Array(ret.buffer, 1).set([...clients].map(({id}) => id))
  return ret.buffer
}

export const clientJoin = (client: Client) => clientPresence(Code.CLIENT_JOIN, client)
export const clientLeave = (client: Client) => clientPresence(Code.CLIENT_LEAVE, client)
export const groupJoin = (group: Group) => groupChange(Code.GROUP_REQUEST, group)
export const groupLeave = (group: Group) => groupChange(Code.GROUP_REJECT, group)

