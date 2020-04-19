import 'should'
import { OPEN } from 'ws'
import BrowserSocket from './util/BrowserSocket'
import SocketServer from '../src/SocketServer'

describe('SocketServer', () => {
  let server: SocketServer

  beforeEach(() => server = new SocketServer({
    maxConnections: 10,
    idleTimeout: 1000
  }))

  afterEach(() => server.close.activate())

  it('Clients can connect', async () => {
    await server.listening.event
    const client = new BrowserSocket(server)

    // This happens after the server connection completes
    await client.open.event
    client.readyState.should.eql(OPEN)
    server.clientCount.should.eql(1)
  })

  it('Respects max connections', async () => {
    await server.listening.event
    const clients = new Array(10)
      .fill(undefined)
      .map(() => new BrowserSocket(server))

    // all clients must be connected
    await Promise.all(clients.map(client => client.open.event))

    // push the limit
    const overflow = new BrowserSocket(server)
    await overflow.open.event

    // no increase
    server.clientCount.should.eql(10)
    await overflow.close.event

    // other clients stay open
    for (const { close } of clients)
      close.triggered.should.be.false()
  })

  it('Idlers are kicked', async () => {
    await server.listening.event

    const client = new BrowserSocket(server)
    await client.open.event
    setTimeout(() => {
      client.close.triggered.should.be.true()
      client.readyState.should.eql(1099)
    }, 1000 + 10 /* Delta */)
  })
})
