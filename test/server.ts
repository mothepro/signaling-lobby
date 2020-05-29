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
    const socket = new BrowserSocket(http, 0, 'mo')
    // This happens after the server connection completes
    await socket.open.event
    socket.readyState.should.eql(OPEN)
    server.count.should.eql(1)
  })

  it('Respects max connections', async () => {
    const clients = [
      new BrowserSocket(http, 0, 'mo'),
      new BrowserSocket(http, 1, 'mo1'),
      new BrowserSocket(http, 2, 'mo2'),
      new BrowserSocket(http, 3, 'mo3'),
      new BrowserSocket(http, 4, 'mo4'),
    ]

    // all clients must be connected
    await Promise.all(clients.map(client => client.open.event))

    // push the limit
    const overflow = new BrowserSocket(http, 5, 'mo5')

    // socket hang up thrown
    overflow.close.event.should.be.rejected()
    overflow.open.triggered.should.be.false()
    server.count.should.eql(5)

    // other clients stay open
    for (const { close } of clients)
      close.triggered.should.be.false()
  })

  it('Kicks Idlers', async () => {
    const socket = new BrowserSocket(http, 0, 'mo')
    await socket.open.event

    await milliseconds(500 + 50) // some delta to allow server to close.

    socket.close.triggered.should.be.true()
    socket.readyState.should.eql(CLOSED)
  })

  it('Kicks clients with invalid names', async () => {
    const socket = new BrowserSocket(http, 0, '\n\t \r\u200b')

    try {
      await socket.close.event
      throw 'should have thrown already'
    } catch (err) {
      err.should.be.instanceof(Error)
      err.message.should.match(/socket hang up/)
    }
  })

  it('Kicks empty messages', async () => {
    const socket = new BrowserSocket(http, 0, '')

    try {
      await socket.close.event
      throw 'should have thrown already'
    } catch (err) {
      err.should.be.instanceof(Error)
      err.message.should.match(/socket hang up/)
    }
  })

  it('Kicks massive messages', async () => {
    const socket = new BrowserSocket(http, 0, 'mo'),
      client = await server.next

    try {
      await filterValue(client.stateChange, State.CONNECTED)
      await socket.open.event
      socket.send(new ArrayBuffer(1000))

      await client.stateChange.next
      throw 'should cancel early'
    } catch (err) {
      err.should.be.instanceof(Error)
      err.message.should.match(/attempted to send 1000 bytes/)
    }

    await socket.close.event
    client.socket.readyState.should.equal(CLOSED)
  })
})
