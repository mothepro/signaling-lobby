import { ClientID } from '../src/messages'

/** Generates the next available ID. */
// TODO specify freed up IDs
// For some reason this is not cast to a never return type.
export default function* (max: number): Generator<ClientID, never, unknown> {
  let next = 0
  while (true) 
    yield next++ % (1+max)
  throw Error(`No available IDs to ${max}.`)
}
