import 'should'
import WebSocket from 'ws'
import ClientSocket from './util/ClientSocket'
import Server from '../src/Server'
import { idleTimeout } from '../src/args'

describe('Server', () => {
  let server: Server

  beforeEach(() => server = new Server({
    maxConnections: 10,
    idleTimeout: 1000
  }))

  afterEach(() => server.close.activate())

  it('Clients can connect', async () => {
    await server.listening.event
    const client = new ClientSocket(server)

    // This happens after the server connection completes
    await client.open.event
    client.readyState.should.eql(WebSocket.OPEN)
    server.allClients.should.have.size(1)
  })

  it('Respects max connections', async () => {
    await server.listening.event
    const clients = new Array(10)
      .fill(undefined)
      .map(() => new ClientSocket(server))

    // all clients must be connected
    await Promise.all(clients.map(client => client.open.event))

    // push the limit
    clients.push(new ClientSocket(server))
    await clients[10].open.event

    // no increase
    server.allClients.should.have.size(10)
    await clients[10].close.event

    // other clients stay open
    clients[0].close.triggered.should.be.false()
  })

  it('Idlers are kicked', async () => {
    await server.listening.event

    const client = new ClientSocket(server)
    await client.open.event
    setTimeout(() => {
      client.close.triggered.should.be.true()
      client.readyState.should.eql(1099)
    }, 1000 + 10 /* Delta */)
  })
})
