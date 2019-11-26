import { SafeEmitter } from 'fancy-emitter'

export default class <T> extends Set<T> {
  private data = new Map<T, NodeJS.Timeout | void>()

  readonly expiration = new SafeEmitter<T>()

  /** Adds a */
  add(value: T, expiration = 0) {
    this.data.set(value, expiration
      ? setTimeout(() => this.expired(value), expiration)
      : undefined)
    return this
  }

  private expired(value: T) {
    if (this.data.has(value)) {
      this.data.delete(value)
      this.expiration.activate(value)
    }
    return this
  }
}
