import { CLOSED } from 'ws'
import SocketServer from '../src/SocketServer'
import { State } from '../src/Client'
import joinLobby from './util/joinLobby'
import { createServer, Server } from 'http'

describe('Groups', () => {
  let server: SocketServer,
  http: Server

  beforeEach(() => server = new SocketServer(http = createServer().listen(), 10, 100, 1000, 100))
  afterEach(() => http.close())

  it('Propose a group', async () => {
    await server.ready.event
    const [mySocket, { id: myId }] = await joinLobby(http, server, 123, 'mo'),
      [otherSocket, { id: otherId }] = await joinLobby(http, server, 123, 'momo')

    // propose group
    mySocket.sendProposal(true, otherId)
    const { approval, ids } = await otherSocket.groupChange.next

    approval.should.be.true()
    ids.should.have.size(1)
    ids.should.containEql(myId)
  })

  it('Group shut down after by data sent', async () => {
    await server.ready.event
    const [mySocket, myClient] = await joinLobby(http, server, 123, 'mo'),
      [otherSocket, { id }] = await joinLobby(http, server, 123, 'momo')

    mySocket.sendProposal(true, id)
    await otherSocket.groupChange.next

    mySocket.send(new Uint8Array([3, 1, 2]).buffer)

    const [state] = await Promise.all([
      myClient.stateChange.next,
      mySocket.close.event,
    ])
    state.should.eql(State.DEAD)
    mySocket.readyState.should.eql(CLOSED)
  })

  it('Can leave a group', async () => {
    await server.ready.event
    const [mySocket, { id: myId }] = await joinLobby(http, server, 123, 'mo'),
      [otherSocket, { id: otherId }] = await joinLobby(http, server, 123, 'momo')

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
    await server.ready.event
    const [mySocket, { id: myId }] = await joinLobby(http, server, 123, 'mo'),
      [otherSocket, { id: otherId }] = await joinLobby(http, server, 123, 'momo')

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
    await server.ready.event
    const [mySocket, { id: myId }] = await joinLobby(http, server, 123, 'mo'),
      [otherSocket, { id: otherId }] = await joinLobby(http, server, 123, 'momo')

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
    await server.ready.event
    const [mySocket, { id: myId }] = await joinLobby(http, server, 123, 'mo'),
      [otherSocket, { id: otherId }] = await joinLobby(http, server, 123, 'momo'),
      [guestSocket] = await joinLobby(http, server, 123, 'lamo')

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

  it('Send data directly when group is synced', async () => {
    await server.ready.event
    const [mySocket, { id: myId }] = await joinLobby(http, server, 123, 'mo'),
      [otherSocket, { id: otherId }] = await joinLobby(http, server, 123, 'momo')

    mySocket.sendProposal(true, otherId)
    otherSocket.sendProposal(true, myId)

    await Promise.all([
      mySocket.groupFinal.next,
      otherSocket.groupFinal.next
    ])

    // I DM other some letters
    mySocket.send(new Uint16Array([otherId, 0xABCD, 0xEF]))
    const otherMessage = await otherSocket.message.next

    // Other DMs me some numbers
    otherSocket.send(new Uint16Array([myId, 0x1234, 0x5678]))
    const myMessage = await mySocket.message.next

    // I receive numbers from other
    myMessage.should.be.instanceOf(Buffer)
    myMessage.should.eql(Buffer.from(new Uint16Array([otherId, 0x1234, 0x5678]).buffer))
    // Other receives letters from me
    otherMessage.should.be.instanceOf(Buffer)
    otherMessage.should.eql(Buffer.from(new Uint16Array([myId, 0xABCD, 0xEF]).buffer))
  })

  it('Eventually the group shall elegantly close', async () => {
    await server.ready.event
    const [mySocket, myClient] = await joinLobby(http, server, 123, 'mo'),
      [otherSocket, otherClient] = await joinLobby(http, server, 123, 'momo')

    mySocket.sendProposal(true, otherClient.id)
    otherSocket.sendProposal(true, myClient.id)
    await Promise.all([
      mySocket.groupFinal.next,
      otherSocket.groupFinal.next
    ])

    const [myState, otherState] = await Promise.all([
      myClient.stateChange.next,
      otherClient.stateChange.next,
      mySocket.close.event,
      otherSocket.close.event,
    ])

    myState.should.eql(State.DEAD)
    otherState.should.eql(State.DEAD)
    mySocket.readyState.should.eql(CLOSED)
    otherSocket.readyState.should.eql(CLOSED)
  })

  it('leaves all other groups once syncing', async () => {
    await server.ready.event
    const [socket0, client0] = await joinLobby(http, server, 123, 'mo'),
      [socket1, client1] = await joinLobby(http, server, 123, 'momo'),
      [socket2] = await joinLobby(http, server, 123, 'mothepro')

    socket0.sendProposal(true, client1.id)
    socket2.sendProposal(true, client0.id)
    await socket1.groupChange.next

    // Form group 0,1. Which should cancel 2,0 proposal
    socket1.sendProposal(true, client0.id)

    await Promise.all([
      // Group members leaving
      socket2.clientPresence.next,
      socket0.groupFinal.next,
      socket1.groupFinal.next,
    ])
  })
})
