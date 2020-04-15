import 'should'
import WebSocket, { AddressInfo } from 'ws'
import createServer from '../src/createServer'

let server: ReturnType<typeof createServer>

describe('Server', () => {

  beforeEach(() => server = createServer(0, 2 ** 10, 2, 20, 1000))

  afterEach(() => server.close())

  it('a client can connect', done => server.on('listening', () => {
    new WebSocket(`ws://localhost:${(server.address() as AddressInfo).port}`)

    server.on('connection', () => done())
  }))

  it('server respects max connections', done => server.on('listening', () => {
    let times = 0

    new WebSocket(`ws://localhost:${(server.address() as AddressInfo).port}`)
    new WebSocket(`ws://localhost:${(server.address() as AddressInfo).port}`)
    new WebSocket(`ws://localhost:${(server.address() as AddressInfo).port}`)

    server.on('connection', () => {
      if (3 == ++times) {
        server.clientCount.should.equal(2)
        done()
      }
    })
  }))
})
