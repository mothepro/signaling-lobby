import 'should'
import { OPEN, CLOSED } from 'ws'
import BrowserSocket from './util/BrowserSocket'
import SocketServer from '../src/SocketServer'
import { createServer, Server } from 'http'
import milliseconds from './util/delay'
import { State } from '../src/Client'

describe('Server', () => {
  let server: SocketServer,
    http: Server

  beforeEach(() => server = new SocketServer(http = createServer().listen(), 10, 100, 500, 100))

  afterEach(() => http.close())

  it('Clients can connect', async () => {
    await server.ready.event
    const client = new BrowserSocket(http)

    // This happens after the server connection completes
    await client.open.event
    client.readyState.should.eql(OPEN)
    server.clientCount.should.eql(1)
  })

  it('Respects max connections', async () => {
    await server.ready.event
    const clients = new Array(10).fill(undefined)
      .map(() => new BrowserSocket(http))

    // all clients must be connected
    await Promise.all(clients.map(client => client.open.event))

    // push the limit
    const overflow = new BrowserSocket(http)

    // socket hang up thrown
    overflow.close.event.should.be.rejected()
    overflow.open.triggered.should.be.false()
    server.clientCount.should.eql(10)

    // other clients stay open
    for (const { close } of clients)
      close.triggered.should.be.false()
  })

  it('Kicks Idlers', async () => {
    await server.ready.event

    const client = new BrowserSocket(http)
    await client.open.event

    await milliseconds(500 + 5) // some delta to allow server to close.

    client.close.triggered.should.be.true()
    client.readyState.should.eql(CLOSED)
  })

  it('Kicks clients with invalid names', async () => {
    await server.ready.event
    const socket = new BrowserSocket(http),
      client = await server.connection.next

    for await (const state of client.stateChange)
      switch (state) {
        case State.CONNECTED:
          await socket.open.event
          socket.sendIntro(123, '\n\t \r\u200b')
          break

        case State.DEAD:
          client.socket.readyState.should.equal(CLOSED)
          await socket.close.event
          return
      }

  })

  it('Kicks non-intros', async () => {
    await server.ready.event
    const socket = new BrowserSocket(http),
      client = await server.connection.next

    for await (const state of client.stateChange)
      switch (state) {
        case State.CONNECTED:
          await socket.open.event
          socket.send(new Uint8Array([0, 1]).buffer)
          break

        case State.DEAD:
          client.socket.readyState.should.equal(CLOSED)
          await socket.close.event
          return
      }
  })

  it('Kicks empty messages', async () => {
    await server.ready.event
    const socket = new BrowserSocket(http),
      client = await server.connection.next

    for await (const state of client.stateChange)
      switch (state) {
        case State.CONNECTED:
          await socket.open.event
          socket.send(new ArrayBuffer(0))
          break

        case State.DEAD:
          client.socket.readyState.should.equal(CLOSED)
          await socket.close.event
          return
      }
  })
})
