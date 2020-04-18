import Server from '../src/Server'
import joinLobby from './util/joinLobby'
import { buildProposal } from './util/builders'
import { parseGroupChange } from './util/parsers'

describe('Groups', () => {
  let server: Server

  beforeEach(() => server = new Server)

  afterEach(() => server.close.activate())


  it('Can join a group', async () => {
    await server.listening.event

    const [mySocket, { id: myId }] = await joinLobby(server, 123, 'mo'),
      [otherSocket, { id: otherId }] = await joinLobby(server, 123, 'momo')

    // join message
    await mySocket.message.next
    await otherSocket.message.next

    mySocket.send(buildProposal(true, otherId))
    const { approval, ids } = parseGroupChange(await otherSocket.message.next)

    approval.should.be.true()
    ids.should.have.size(1)
    ids.should.containEql(myId)
  })
})
