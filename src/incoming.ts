import { Data } from 'ws'
import { Size, ClientID } from '../util/constants'

/** Update a group proposal. */
export interface Proposal {
  /** True to accept or create, False to reject. */
  approve: boolean

  /** Other clients to include in group. */
  ids: ReadonlySet<ClientID>
}

/** Data sent after a sync. */
export interface SyncBuffer {
  /** Who the data was directed to. */
  to: ClientID

  /** View of the buffer sent, including the `to`. */
  content: DataView
}

function dataToView(input: Data, type: string, assert: (view: DataView) => boolean) {
  if (input instanceof ArrayBuffer) {
    const data = new DataView(input)
    if (assert(data))
      return data
  }

  throw TypeError(`Expected ${type} but got '${input}' ${input instanceof ArrayBuffer
    ? input.byteLength + ' bytes: 0x'
      + [...new Uint8Array(input)].map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' 0x')
    : ''}`.trim())
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

export function getSyncBuffer(input: Data): SyncBuffer {
  const content = dataToView(input, 'Sync Buffer', view => view.byteLength > Size.SHORT)
  return {
    to: content.getUint16(0, true),
    content,
  }
}

