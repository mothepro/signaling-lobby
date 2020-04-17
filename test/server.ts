import 'should'
import WebSocket from 'ws'
import { Max } from './util/constants'
import ClientSocket from './util/ClientSocket'
import Server from '../src/Server'

describe('Server', () => {
  let server: Server

  beforeEach(() => server = new Server(0, Max.PAYLOAD, Max.CONNECTIONS, Max.NAME_LENGTH, Max.IDLE_TIME))

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
    const clients = new Array(Max.CONNECTIONS)
      .fill(undefined)
      .map(() => new ClientSocket(server))

    // all clients must be connected
    await Promise.all(clients.map(client => client.open.event))

    // push the limit
    clients.push(new ClientSocket(server))
    await clients[Max.CONNECTIONS].open.event

    // no increase
    server.allClients.should.have.size(Max.CONNECTIONS)
    await clients[Max.CONNECTIONS].close.event

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
    }, Max.IDLE_TIME + 10 /* Delta */)
  })
})
