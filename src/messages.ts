import { Data } from 'ws'
import { TextEncoder, TextDecoder } from 'util'
import stringSantizer from './util/stringSantizer'
import { Size } from './util/constants'
import Client from './Client'

const encoder = new TextEncoder
const decoder = new TextDecoder

export type Name = string

/** Int32 (4 bytes) to represent the ID of a lobby. */
export type LobbyID = number

/** Uint16 (2 bytes) to represent the ID of a client. */
export type ClientID = number

function dataToView(input: Data, type: string, assert: (view: DataView) => boolean) {
  if (input instanceof ArrayBuffer) {
    const data = new DataView(input)
    if (assert(data))
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
export function getIntro(input: Data): Intro {
  const data = dataToView(input, 'Introduction', view => view.byteLength > Size.INT)
  return {
    lobby: data.getInt32(0, true),
    name: stringSantizer(decoder.decode(data.buffer.slice(Size.INT))),
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
  const data = dataToView(input, 'Group Proposal',
    // Leading true or false, followed by Shorts
    view => view.byteLength >= Size.CHAR + Size.SHORT
      && view.byteLength % Size.SHORT == Size.CHAR
      && (view.getUint8(0) == +false || view.getUint8(0) == +true))

  return {
    ids: new Set(new Uint16Array(data.buffer.slice(Size.CHAR))),
    approve: !!data.getUint8(0),
  }
}

// Data sent to the browsers

const enum Code {
  CLIENT_LEAVE,
  CLIENT_JOIN,
  GROUP_REQUEST,
  GROUP_REJECT,
}

function clientPresence(join: Code.CLIENT_LEAVE | Code.CLIENT_JOIN, id: ClientID, name: Name) {
  const nameBuffer = encoder.encode(name),
    ret = new DataView(new ArrayBuffer(Size.CHAR + Size.SHORT + nameBuffer.byteLength))
  ret.setUint8(0, join)
  ret.setUint16(Size.CHAR, id, true)
  new Uint8Array(ret.buffer, Size.CHAR + Size.SHORT).set(nameBuffer)
  return ret.buffer
}

function groupChange(approval: Code.GROUP_REJECT | Code.GROUP_REQUEST, ...ids: ClientID[]) {
  const ret = new DataView(new ArrayBuffer(Size.CHAR + ids.length * Size.SHORT))
  ret.setUint8(0, approval)
  new Uint8Array(ret.buffer, Size.CHAR).set(new Uint16Array(ids))
  return ret.buffer
}

export const clientJoin = ({ name, id }: Client) => clientPresence(Code.CLIENT_JOIN, id, name!)
export const clientLeave = ({ name, id }: Client) => clientPresence(Code.CLIENT_LEAVE, id, name!)
export const groupJoin = (...ids: ClientID[]) => groupChange(Code.GROUP_REQUEST, ...ids)
export const groupLeave = (...ids: ClientID[]) => groupChange(Code.GROUP_REJECT, ...ids)

