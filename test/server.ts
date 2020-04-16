import 'should'
import WebSocket from 'ws'
import createServer from '../src/createServer'
import { makeClient } from './util'

describe('Server', () => {
  let server: ReturnType<typeof createServer>

  beforeEach(() => server = createServer(0, 2 ** 10, 2, 20, 500))

  afterEach(() => server.close())

  it('Clients can connect', done => server.on('listening', () => {
    const client = makeClient(server)

    client.once('open', () => { // This happens after the server connection completes
      client.readyState.should.eql(WebSocket.OPEN)
      server.clientCount.should.equal(1)
      done()
    })
  }))

  it('Respects max connections', done => server.on('listening', () => {
    let times = 0
    makeClient(server)
    makeClient(server)
    makeClient(server)

    server.on('connection', () => {
      if (3 == ++times) {
        server.clientCount.should.equal(2)
        done()
      }
    })
  }))

  it('Idlers are kicked', () => new Promise((resolve, reject) => {
    server.on('listening', () => {
      const client = makeClient(server)
      client.once('close', resolve)
      client.once('open', () => setTimeout(reject, 500))
    })
  }))
})