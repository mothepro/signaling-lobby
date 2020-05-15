import { Listener } from 'fancy-emitter'
import { OPEN, CLOSED } from 'ws'
import BrowserSocket from './util/BrowserSocket'
import createSignalingLobby from '../src/createSignalingLobby'
import { createServer, Server } from 'http'
import milliseconds from './util/delay'
import Client, { State } from '../src/Client'

describe('Server', () => {
  let server: Listener<Client>,
    socket: BrowserSocket,
    http: Server

  beforeEach(async () => {
    http = createServer().listen()
    server = await createSignalingLobby({
      maxConnections: 5,
      maxSize: 100,
      maxLength: 100,
      idleTimeout: 500,
      syncTimeout: 100,
    }, http)
    socket = new BrowserSocket(http)
  })

  afterEach(() => http.close())

  it('Clients can connect', async () => {
    // This happens after the server connection completes
    await socket.open.event
    socket.readyState.should.eql(OPEN)
    server.count.should.eql(1)
  })

  it('Respects max connections', async () => {
    const clients = [
      socket,
      new BrowserSocket(http),
      new BrowserSocket(http),
      new BrowserSocket(http),
      new BrowserSocket(http),
    ]

    // all clients must be connected
    await Promise.all(clients.map(client => client.open.event))

    // push the limit
    const overflow = new BrowserSocket(http)

    // socket hang up thrown
    overflow.close.event.should.be.rejected()
    overflow.open.triggered.should.be.false()
    server.count.should.eql(5)

    // other clients stay open
    for (const { close } of clients)
      close.triggered.should.be.false()
  })

  it('Kicks Idlers', async () => {
    await socket.open.event

    await milliseconds(500 + 15) // some delta to allow server to close.

    socket.close.triggered.should.be.true()
    socket.readyState.should.eql(CLOSED)
  })

  it('Kicks clients with invalid names', async () => {
    const client = await server.next

    try {
      for await (const state of client.stateChange)
        if (state == State.CONNECTED) {
          await socket.open.event
          socket.sendIntro(123, '\n\t \r\u200b')
        }
      throw 'should cancel early'
    } catch (err) {
      err.should.be.instanceof(TypeError)
      err.message.should.be.eql('Expected to sanitize a string')
    }

    await socket.close.event
    client.socket.readyState.should.equal(CLOSED)
  })

  it('Kicks non-intros', async () => {
    const client = await server.next

    try {
      for await (const state of client.stateChange)
        if (state == State.CONNECTED) {
          await socket.open.event
          socket.send(new Uint8Array([0, 1]).buffer)
        }
      throw 'should cancel early'
    } catch (err) {
      err.should.be.instanceof(TypeError)
      err.message.should.startWith('Expected Introduction')
    }

    await socket.close.event
    client.socket.readyState.should.equal(CLOSED)
  })

  it('Kicks empty messages', async () => {
    const client = await server.next

    try {
      for await (const state of client.stateChange)
        if (state == State.CONNECTED) {
          await socket.open.event
          socket.send(new ArrayBuffer(0))
        }
      throw 'should cancel early'
    } catch (err) {
      err.should.be.instanceof(Error)
      err.message.should.match(/attempted to send 0 bytes/)
    }

    await socket.close.event
    client.socket.readyState.should.equal(CLOSED)
  })

  it('Kicks massive messages', async () => {
    const client = await server.next

    try {
      for await (const state of client.stateChange)
        if (state == State.CONNECTED) {
          await socket.open.event
          socket.send(new ArrayBuffer(1000))
        }
      throw 'should cancel early'
    } catch (err) {
      err.should.be.instanceof(Error)
      err.message.should.match(/attempted to send 1000 bytes/)
    }

    await socket.close.event
    client.socket.readyState.should.equal(CLOSED)
  })

  it('Kicks big messages messages', async () => {
    const client = await server.next

    try {
      for await (const state of client.stateChange)
        if (state == State.CONNECTED) {
          await socket.open.event
          socket.send(new ArrayBuffer(1000))
        }
      throw 'should cancel early'
    } catch (err) {
      err.should.be.instanceof(TypeError)
      err.message.should.startWith('Expected Introduction')
    }

    await socket.close.event
    client.socket.readyState.should.equal(CLOSED)
  })
})
