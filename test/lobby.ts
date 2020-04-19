import { CLOSED, OPEN } from 'ws'
import BrowserSocket from './util/BrowserSocket'
import joinLobby from './util/joinLobby'
import SocketServer from '../src/SocketServer'
import { State } from '../src/Client'
import { createServer, Server } from 'http'

describe('Lobby', () => {
  let server: SocketServer,
  http: Server

  beforeEach(() => server = new SocketServer(http = createServer().listen(), 10, 100, 1000, 100))

  afterEach(() => http.close())

  it('Ignores clients with invalid names', async () => {
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

  it('Ignores non-intros before lobby', async () => {
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

  it('Ignores empty messages before lobby', async () => {
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

  it('Client can connect', async () => {
    await server.ready.event

    // Zero width chars are removed from the names
    const [socket, client] = await joinLobby(http, server, 123, '\n\tmo\r\u200b')

    socket.close.triggered.should.be.false()
    socket.readyState.should.eql(OPEN)
    client.lobby!.should.eql(123)
    client.name!.should.eql('mo')
  })

  it('Multiple clients are notified when joining', async () => {
    await server.ready.event

    const [mySocket, myClient] = await joinLobby(http, server, 123, 'mo'),
      [otherSocket, otherClient] = await joinLobby(http, server, 123, 'momo'),
      msg1 = await mySocket.clientPresence.next,
      msg2 = await otherSocket.clientPresence.next

    msg1.join.should.be.true()
    msg2.join.should.be.true()
    msg1.id.should.eql(otherClient.id)
    msg2.id.should.eql(myClient.id)
    msg1.name!.should.eql('momo')
    msg2.name!.should.eql('mo')
  })

  it('Multiple clients are notified when leaving', async () => {
    await server.ready.event

    const [socket] = await joinLobby(http, server, 123, 'mo'),
      [socket2, client2] = await joinLobby(http, server, 123, 'momo')

    socket2.exit()
    await client2.stateChange.next
    const { join, id } = await socket.clientPresence.next

    join.should.be.false()
    id.should.eql(client2.id)
  })
})
