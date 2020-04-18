import Server from '../src/Server'
import joinLobby from './util/joinLobby'
import { buildProposal } from './util/builders'

describe('Groups', () => {
  let server: Server

  beforeEach(() => server = new Server)

  afterEach(() => server.close.activate())

  it.only('Propose a group', async () => {
    await server.listening.event

    const [mySocket, { id: myId }] = await joinLobby(server, 123, 'mo'),
      [otherSocket, { id: otherId }] = await joinLobby(server, 123, 'momo')

    // propose group
    mySocket.send(buildProposal(true, otherId))
    const { approval, ids } = await otherSocket.groupChange.next

    approval.should.be.true()
    ids.should.have.size(1)
    ids.should.containEql(myId)
  })

  it('Can leave a group after proposal', async () => {
    await server.listening.event

    const [mySocket, { id: myId }] = await joinLobby(server, 123, 'mo'),
      [otherSocket, { id: otherId }] = await joinLobby(server, 123, 'momo')

    // propose group
    mySocket.send(buildProposal(true, otherId))
    await otherSocket.groupChange.next

    // leave group
    mySocket.send(buildProposal(false, otherId))
    const { approval, ids } = await otherSocket.groupChange.next

    approval.should.be.false()
    ids.should.have.size(1)
    ids.should.containEql(myId)
  })

  it('be a part of multiple groups')
  it('leaves all other groups once syncing')
})
