import { SingleEmitter } from 'fancy-emitter'
import { ClientID } from './messages'

// sort order doesn't matter as long as it is always consistent
export const hashIds = (...ids: ClientID[]) => ids.sort().join()

export default class {

  private readonly acks: Set<ClientID> = new Set

  readonly ready = new SingleEmitter

  constructor(readonly participants: Set<ClientID>) {}

  verify(allClients: Map<ClientID, unknown>) {
    const nonExistant = [...this.participants].filter(id => !allClients.has(id))

    if (nonExistant.length)
      this.ready.deactivate(Error(`Attempted to add non existant clients ${nonExistant.join(', ')}`))
    
    return this
  }

  accept(id: ClientID) {
    if (this.participants.has(id)) {
      this.acks.add(id)

      // Everyone is in!
      if (this.acks.size == this.participants.size)
        this.ready.activate()
    } else
      this.ready.deactivate(Error(`${id} can not accept a group that doesn't include them`))
  }
}
