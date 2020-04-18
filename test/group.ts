import Server from '../src/Server'
import joinLobby from './util/joinLobby'
import { setLevel, Level } from '../src/util/logger'
import { OutgoingMessage } from 'http'

describe('Groups', () => {
  let server: Server

  beforeEach(() => server = new Server)

  afterEach(() => server.close.activate())

  it('Propose a group', async () => {
    await server.listening.event
    const [mySocket, { id: myId }] = await joinLobby(server, 123, 'mo'),
      [otherSocket, { id: otherId }] = await joinLobby(server, 123, 'momo')

    // propose group
    mySocket.sendProposal(true, otherId)
    const { approval, ids } = await otherSocket.groupChange.next

    approval.should.be.true()
    ids.should.have.size(1)
    ids.should.containEql(myId)
  })

  it('Can leave a group', async () => {
    await server.listening.event
    const [mySocket, { id: myId }] = await joinLobby(server, 123, 'mo'),
      [otherSocket, { id: otherId }] = await joinLobby(server, 123, 'momo')

    // propose group
    mySocket.sendProposal(true, otherId)
    await otherSocket.groupChange.next

    // leave group
    otherSocket.sendProposal(false, myId)
    const { approval, ids } = await mySocket.groupChange.next

    approval.should.be.false()
    ids.should.have.size(1)
    ids.should.containEql(otherId)
  })

  it('Can leave a group after proposal', async () => {
    await server.listening.event
    const [mySocket, { id: myId }] = await joinLobby(server, 123, 'mo'),
      [otherSocket, { id: otherId }] = await joinLobby(server, 123, 'momo')

    // propose group
    mySocket.sendProposal(true, otherId)
    await otherSocket.groupChange.next

    // leave group
    mySocket.sendProposal(false, otherId)
    const { approval, ids } = await otherSocket.groupChange.next

    approval.should.be.false()
    ids.should.have.size(1)
    ids.should.containEql(myId)
  })

  it('Form a group', async () => {
    await server.listening.event
    const [mySocket, { id: myId }] = await joinLobby(server, 123, 'mo'),
      [otherSocket, { id: otherId }] = await joinLobby(server, 123, 'momo')

    mySocket.sendProposal(true, otherId)
    otherSocket.sendProposal(true, myId)

    const [myCode, otherCode] = await Promise.all([
      mySocket.groupFinal.next,
      otherSocket.groupFinal.next
    ])

    myCode.should.be.aboveOrEqual(0)
    myCode.should.be.below(2 ** 32)
    myCode.should.eql(otherCode)
  })

  it('Notify lobby clients when group is formed', async () => {
    await server.listening.event
    const [mySocket, { id: myId }] = await joinLobby(server, 123, 'mo'),
      [otherSocket, { id: otherId }] = await joinLobby(server, 123, 'momo'),
      [guestSocket] = await joinLobby(server, 123, 'lamo')

    mySocket.sendProposal(true, otherId)
    otherSocket.sendProposal(true, myId)
    await mySocket.groupFinal.next

    const { id: id1, join: join1 } = await guestSocket.clientPresence.next,
      { id: id2, join: join2 } = await guestSocket.clientPresence.next

    join1.should.be.false()
    join2.should.be.false()
    id1.should.equalOneOf(myId, otherId)
    id2.should.equalOneOf(myId, otherId)
  })

  it('Send data when group is synced', async () => {
    await server.listening.event
    const [mySocket, { id: myId }] = await joinLobby(server, 123, 'mo'),
      [otherSocket, { id: otherId }] = await joinLobby(server, 123, 'momo')

    mySocket.sendProposal(true, otherId)
    otherSocket.sendProposal(true, myId)

    await Promise.all([
      mySocket.groupFinal.next,
      otherSocket.groupFinal.next
    ])

    mySocket.send(new Uint8Array([0xAB, 0xCD, 0xEF]).buffer)
    const incoming1 = await otherSocket.message.next

    otherSocket.send(new Uint8Array([0x12, 0x34, 0x56, 0x78]).buffer)
    const incoming0 = await mySocket.message.next

    incoming0.should.be.instanceOf(Buffer)
    incoming0.should.eql(Buffer.from([0x12, 0x34, 0x56, 0x78]))
    incoming1.should.be.instanceOf(Buffer)
    incoming1.should.eql(Buffer.from([0xAB, 0xCD, 0xEF]))
  })

  it('be a part of multiple groups')
  it('leaves all other groups once syncing')
})
