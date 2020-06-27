import { TextEncoder } from 'util'
import { Size, ClientID, Code, Name } from '../util/constants'
import Client from './Client'

const encoder = new TextEncoder

export function clientJoin({ name, id }: Client) {
  const nameBuffer = encoder.encode(name!),
    ret = new DataView(new ArrayBuffer(Size.CHAR + Size.SHORT + nameBuffer.byteLength))
  ret.setUint8(0, Code.CLIENT_JOIN)
  ret.setUint16(Size.CHAR, id, true)
  new Uint8Array(ret.buffer, Size.CHAR + Size.SHORT).set(nameBuffer)
  return ret.buffer
}

export function yourName(name: Name) {
  const nameBuffer = encoder.encode(name!),
    ret = new DataView(new ArrayBuffer(Size.CHAR + nameBuffer.byteLength))
  ret.setUint8(0, Code.YOUR_NAME)
  new Uint8Array(ret.buffer, Size.CHAR).set(nameBuffer)
  return ret.buffer
}

export function clientLeave({ id }: Client) {
  const ret = new DataView(new ArrayBuffer(Size.CHAR + Size.SHORT))
  ret.setUint8(0, Code.CLIENT_LEAVE)
  ret.setUint16(Size.CHAR, id, true)
  return ret.buffer
}

function groupChange(approval: Code.GROUP_REJECT | Code.GROUP_REQUEST, ...ids: ClientID[]) {
  const ret = new DataView(new ArrayBuffer(Size.CHAR + ids.length * Size.SHORT))
  ret.setUint8(0, approval)
  for (let i = 0; i < ids.length; i++)
    ret.setUint16(Size.CHAR + i * Size.SHORT, ids[i], true)
  return ret.buffer
}

export const groupJoin = (...ids: ClientID[]) => groupChange(Code.GROUP_REQUEST, ...ids)
export const groupLeave = (...ids: ClientID[]) => groupChange(Code.GROUP_REJECT, ...ids)
export function groupFinal(code: number, ...ids: ClientID[]) {
  const ret = new DataView(new ArrayBuffer(Size.CHAR + Size.INT + ids.length * Size.SHORT))
  ret.setUint8(0, Code.GROUP_FINAL)
  ret.setUint32(Size.CHAR, code, true)
  for (let i = 0; i < ids.length; i++)
    ret.setUint16(Size.CHAR + Size.INT + i * Size.SHORT, ids[i], true)
  return ret.buffer
}
