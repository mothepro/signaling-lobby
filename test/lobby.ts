import 'should'
import { Listener } from 'fancy-emitter'
import { createServer, Server } from 'http'
import { OPEN } from 'ws'
import joinLobby, { nextLobby } from './util/joinLobby'
import createSignalingLobby from '../src/createSignalingLobby'
import Client from '../src/Client'

describe('Lobby', () => {
  let server: Listener<Client>, http: Server

  beforeEach(async () => server = await createSignalingLobby({
    maxConnections: 10,
    maxLength: 100,
    idleTimeout: 1000,
    syncTimeout: 100,
  }, http = createServer().listen()))

  it('Client can connect to lobby', async () => {
    // Zero width chars are removed from the names
    const lobby = nextLobby(),
      [socket, client] = await joinLobby(http, server, '\n\tmo\r\u200b', lobby)

    socket.close.triggered.should.be.false()
    socket.readyState.should.eql(OPEN)
    client.lobby!.should.eql(lobby)
    client.name!.should.eql('mo')
  })

  it('Multiple clients are notified when joining', async () => {
    const lobby = nextLobby(),
      [mySocket, myClient] = await joinLobby(http, server, 'mo', lobby),
      [otherSocket, otherClient] = await joinLobby(http, server, 'momo', lobby),
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
    const lobby = nextLobby(),
      [socket] = await joinLobby(http, server, 'mo', lobby),
      [socket2, client2] = await joinLobby(http, server, 'momo', lobby)

    socket2.exit()
    await client2.stateChange.next
    const { join, id } = await socket.clientPresence.next

    join.should.be.false()
    id.should.eql(client2.id)
  })
})
