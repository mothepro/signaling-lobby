import { Data } from 'ws'
import { Size } from '../../src/util/constants'

export function clientPresence(data: Data) {
  if (data instanceof Buffer && data.byteLength >= Size.CHAR + Size.SHORT + 1)
    return {
      join: !!data.readInt8(0),
      id: data.readUInt16LE(Size.CHAR),
      name: data.toString('utf-8', Size.CHAR + Size.SHORT)
    }
  throw TypeError('Expected to receive a client presence buffer from the server')
}
