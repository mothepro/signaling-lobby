import { Listener, filterValue } from 'fancy-emitter'
import { OPEN, CLOSED } from 'ws'
import BrowserSocket from './util/BrowserSocket'
import createSignalingLobby from '../src/createSignalingLobby'
import { createServer, Server } from 'http'
import milliseconds from './util/delay'
import Client, { State } from '../src/Client'

describe('Server', () => {
  let server: Listener<Client>,
    http: Server

  beforeEach(async () =>
    server = await createSignalingLobby({
      maxConnections: 5,
      maxSize: 100,
      maxLength: 100,
      idleTimeout: 500,
      syncTimeout: 100,
    }, http = createServer().listen()))

  afterEach(() => http.close())

  it('Clients can connect', async () => {
    const socket = new BrowserSocket(http, '0', 'mo')
    // This happens after the server connection completes
    await socket.open
    socket.readyState.should.eql(OPEN)
    server.count.should.eql(1)
  })

  it('Respects max connections', async () => {
    const clients = [
      new BrowserSocket(http, '0', 'mo'),
      new BrowserSocket(http, '1', 'mo1'),
      new BrowserSocket(http, '2', 'mo2'),
      new BrowserSocket(http, '3', 'mo3'),
      new BrowserSocket(http, '4', 'mo4'),
    ]

    // all clients must be connected
    await Promise.all(clients.map(client => client.open))

    // push the limit
    const overflow = new BrowserSocket(http, '5', 'overflow')

    // socket hang up thrown
    overflow.close.should.be.rejected()
    overflow.connected.should.be.false()
    server.count.should.eql(5)

    // other clients stay open
    for (const { connected } of clients)
      connected.should.be.true()
  })

  it('Kicks Idlers', async () => {
    const socket = new BrowserSocket(http, '0', 'mo')
    await socket.open

    await milliseconds(500 + 50) // some delta to allow server to close.

    socket.connected.should.be.false()
    socket.readyState.should.eql(CLOSED)
  })

  it('Kicks clients with invalid names', async () => {
    const socket = new BrowserSocket(http, '0', '\n\t \r\u200b')

    socket.close.should.be.rejected()
  })

  it('Kicks empty messages', async () => {
    const socket = new BrowserSocket(http, '0', '')

    socket.close.should.be.rejected()
  })

  it('Kicks massive messages', async () => {
    const socket = new BrowserSocket(http, '0', 'mo'),
      client = await server.next

    try {
      await filterValue(client.stateChange, State.CONNECTED)
      await socket.open
      socket.send(new ArrayBuffer(1000))

      await client.stateChange.next
      throw 'should cancel early'
    } catch (err) {
      err.should.be.instanceof(Error)
      err.message.should.match(/attempted to send 1000 bytes/)
    }

    await socket.close
    client.socket.readyState.should.equal(CLOSED)
  })
})


it('Assign anonymous name', async () => {
  const http = createServer().listen(),
    server = await createSignalingLobby({
      maxConnections: 5,
      maxSize: 100,
      maxLength: 100,
      idleTimeout: 500,
      syncTimeout: 100,
      anonymousPrefix: ' ',
    }, http),
    socket = new BrowserSocket(http, '0', '')
  
  await socket.open
  const name = await socket.yourName.next

  name.length.should.be.greaterThan(1)
  name.length.should.be.lessThan(100)
  socket.readyState.should.eql(OPEN)
  server.count.should.eql(1)

  http.close()
})
