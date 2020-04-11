/** Simple Pausable Timeout. */
export default class {
  private handle!: NodeJS.Timeout

  private start!: number

  constructor(
    private readonly fn: (...args: any[]) => void,
    private remaining: number) {
    this.resume()
  }

  resume() {
    this.start = Date.now()
    if (this.handle)
      clearTimeout(this.handle)
    this.handle = setTimeout(this.fn, this.remaining)
  }

  pause() {
    this.stop()
    this.remaining -= Date.now() - this.start
  }

  stop() {
    clearTimeout(this.handle)
  }
}
