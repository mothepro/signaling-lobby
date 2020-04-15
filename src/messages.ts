import { Data } from 'ws'
import { TextEncoder, TextDecoder } from 'util'
import stringSantizer from './util/stringSantizer'
import Client from './Client'
import Group from './Group'

const encoder = new TextEncoder
const decoder = new TextDecoder

export type Name = string

/** Int32 (4 bytes) to represent the ID of a lobby. */
export type LobbyID = number

/** Uint16 (2 bytes) to represent the ID of a client. */
export type ClientID = number

function dataToView(input: Data, type: string, ...assertions: ((view: DataView) => boolean)[]) {
  if (input instanceof ArrayBuffer) {
    const data = new DataView(input)
    for (const assert of assertions)
      if (!assert(data))
        break
    return data
  }
    
  throw TypeError(`Expected ${type} but got '${input}'`)
}

/** Tell the server to add me to lobby with other potential clients. */
export interface Intro {
  /** Name to use as client. */
  name: Name

  /** ID of lobby to join */
  lobby: LobbyID
}

// TODO use a STATUS bit to determine data type
export function getIntro(input: Data): { name: Name, lobby: LobbyID } {
  const data = dataToView(input, 'Introduction', view => view.byteLength > 4)
  return {
    lobby: data.getInt32(0, true),
    name: stringSantizer(decoder.decode(data.buffer.slice(4))),
  }
}

/** Update a group proposal. */
export interface Proposal {
  /** True to accept or create, False to reject. */
  approve: boolean

  /** Other clients to include in group. */
  ids: Set<ClientID>
}

export function getProposal(input: Data): Proposal {
  const data = dataToView(
    input, 'Group Proposal',
    view => view.getUint8(0) == 0 || view.getUint8(0) == 1,
    ({ byteLength }) => byteLength >= 1 + 2,
    ({ byteLength }) => byteLength % 2 == 1)
  
  return {
    ids: new Set(new Uint16Array(data.buffer.slice(1))),
    approve: !!data.getUint8(0),
  }
}

// Data sent to the browsers

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

