import { ClientID } from '../messages'

/** Generates the next available ID. */
// TODO specify freed up IDs
export default function* (max: number): Generator<ClientID, never, unknown> {
  let next = 0
  while (true) // for(;;) ... for some reason this has a different type definition -_-
    yield next++ % max
  throw Error(`No available IDs to ${max}.`)
}