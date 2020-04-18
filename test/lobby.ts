import { CLOSED, OPEN } from 'ws'
import BrowserSocket from './util/BrowserSocket'
import joinLobby from './util/joinLobby'
import Server from '../src/Server'
import { State } from '../src/Client'
import { clientPresence } from './util/parsers'

describe('Lobby', () => {
  let server: Server

  beforeEach(() => server = new Server)

  afterEach(() => server.close.activate())

  it('Ignores non-intros before lobby', async () => {
    await server.listening.event
    const socket = new BrowserSocket(server),
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

  it('Client can connect', async () => {
    await server.listening.event

    const [socket, client] = await joinLobby(server, 123, 'mo')

    socket.close.triggered.should.be.false()
    socket.readyState.should.eql(OPEN)
    client.lobby!.should.eql(123)
    client.name!.should.eql('mo')
  })

  it('Multiple clients are notified on eachother', async () => {
    await server.listening.event

    const [socket1, client1] = await joinLobby(server, 123, 'mo'),
      [socket2, client2] = await joinLobby(server, 123, 'momo'),
      msg1 = clientPresence(await socket1.message.next),
      msg2 = clientPresence(await socket2.message.next)

    msg1.join.should.be.true()
    msg2.join.should.be.true()
    msg1.id.should.eql(client2.id)
    msg2.id.should.eql(client1.id)
    msg1.name.should.eql('momo')
    msg2.name.should.eql('mo')
  })
})
