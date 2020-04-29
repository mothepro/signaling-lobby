import { CLOSED, OPEN } from 'ws'
import BrowserSocket from './util/BrowserSocket'
import joinLobby, { nextLobby } from './util/joinLobby'
import SocketServer from '../src/SocketServer'
import { createServer, Server } from 'http'

describe('Lobby', () => {
  let server: SocketServer,
  http: Server

  beforeEach(() => server = new SocketServer(http = createServer().listen(), 10, 100, 1000, 100))

  afterEach(() => http.close())

  it('Client can connect to lobby', async () => {
    await server.ready.event

    // Zero width chars are removed from the names
    const lobby = nextLobby(),
      [socket, client] = await joinLobby(http, server, '\n\tmo\r\u200b', lobby)

    socket.close.triggered.should.be.false()
    socket.readyState.should.eql(OPEN)
    client.lobby!.should.eql(lobby)
    client.name!.should.eql('mo')
  })

  it('Multiple clients are notified when joining', async () => {
    await server.ready.event

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
    await server.ready.event

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
