import createServer from '../src/createServer'
import WebSocket, { AddressInfo } from 'ws'

let server: WebSocket.Server

describe('Server', () => {

  beforeEach(() => server = createServer(0, 2 ** 10, 5, 20, 1000))

  afterEach(() => server.close())

  it('a client can connect', done => {
    server.on('listening', () => {
      new WebSocket(`ws://localhost:${(server.address() as AddressInfo).port}`)
      server.on('connection', () => done())
    })
  })
})
