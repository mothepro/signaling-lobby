import { Data } from 'ws'
import { Size } from '../../src/util/constants'

export function parseClientPresence(data: Data) {
  if (data instanceof Buffer
    && data.byteLength >= Size.CHAR + Size.SHORT + 1)
    return {
      join: !!data.readInt8(0),
      id: data.readUInt16LE(Size.CHAR),
      name: data.toString('utf-8', Size.CHAR + Size.SHORT)
    }
  throw TypeError('Expected to receive a client presence buffer from the server')
}

export function parseGroupChange(data: Data) {
  if (data instanceof Buffer
    && data.byteLength >= Size.CHAR + Size.SHORT
    && data.byteLength % Size.SHORT == Size.CHAR) {
    // Buffer -> UInt16Array is not WAI. Do not rely on the underlying ArrayBuffer `data.buffer`
    const ids = []
    for (let offset = Size.CHAR; offset < data.byteLength; offset += Size.SHORT)
      ids.push(data.readUInt16LE(offset))
    return { ids, approval: !!data.readInt8(0) }
  }
  throw TypeError('Expected to receive a group proposal buffer from the server')
}
