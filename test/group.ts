import 'should'
import { Listener } from 'fancy-emitter'
import { CLOSED } from 'ws'
import { createServer, Server } from 'http'
import createSignalingLobby from '../src/createSignalingLobby'
import Client, { State } from '../src/Client'
import joinLobby, { nextLobby } from './util/joinLobby'

describe('Groups', () => {
  let server: Listener<Client>, http: Server

  beforeEach(async () => server = await createSignalingLobby({
    maxConnections: 10,
    maxLength: 100,
    idleTimeout: 1000,
    syncTimeout: 100,
  }, http = createServer().listen()))

  afterEach(() => http.close())

  it('Propose a group', async () => {
    const lobby = nextLobby(),
      [mySocket, { id: myId }] = await joinLobby(http, server, 'mo', lobby),
      [otherSocket, { id: otherId }] = await joinLobby(http, server, 'momo', lobby)

    // propose group
    mySocket.sendProposal(true, otherId)
    const { approval, ids } = await otherSocket.groupChange.next

    approval.should.be.true()
    ids.should.have.size(1)
    ids.should.containEql(myId)
  })

  it('Group shut down after client leaves', async () => {
    const lobby = nextLobby(),
      [mySocket, myClient] = await joinLobby(http, server, 'mo', lobby),
      [otherSocket, otherClient] = await joinLobby(http, server, 'momo', lobby)

    mySocket.sendProposal(true, otherClient.id)
    await otherSocket.groupChange.next

    mySocket.exit()

    await myClient.stateChange.on(() => { }) // listener finished
    const { approval, ids } = await otherSocket.groupChange.next

    myClient.stateChange.isAlive.should.be.false()
    approval.should.be.false()
    ids.should.have.size(1)
    ids.should.containEql(myClient.id)
  })

  it('Group shut down after by data sent', async () => {
    const lobby = nextLobby(),
      [mySocket, myClient] = await joinLobby(http, server, 'mo', lobby),
      [otherSocket, { id }] = await joinLobby(http, server, 'momo', lobby)

    mySocket.sendProposal(true, id)
    await otherSocket.groupChange.next

    mySocket.send(new Uint8Array([3, 1, 2]).buffer)

    myClient.stateChange.next.should.rejectedWith(/Expected Group Proposal/)
    await mySocket.close.event
    mySocket.readyState.should.eql(CLOSED)
  })

  it('Can leave a group', async () => {
    const lobby = nextLobby(),
      [mySocket, { id: myId }] = await joinLobby(http, server, 'mo', lobby),
      [otherSocket, { id: otherId }] = await joinLobby(http, server, 'momo', lobby)

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
    const lobby = nextLobby(),
      [mySocket, { id: myId }] = await joinLobby(http, server, 'mo', lobby),
      [otherSocket, { id: otherId }] = await joinLobby(http, server, 'momo', lobby)

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
    const lobby = nextLobby(),
      [mySocket, { id: myId }] = await joinLobby(http, server, 'mo', lobby),
      [otherSocket, { id: otherId }] = await joinLobby(http, server, 'momo', lobby)

    mySocket.sendProposal(true, otherId)
    otherSocket.sendProposal(true, myId)

    const [
      { ids: myGroupIDs, code: myCode },
      { ids: otherGroupIDs, code: otherCode },
    ] = await Promise.all([
      mySocket.groupFinal.next,
      otherSocket.groupFinal.next,
    ])

    myCode.should.be.aboveOrEqual(0)
    myCode.should.be.below(2 ** 32)
    myCode.should.eql(otherCode)
    myGroupIDs.should.have.size(1)
    myGroupIDs.should.containEql(otherId)
    otherGroupIDs.should.have.size(1)
    otherGroupIDs.should.containEql(myId)
  })

  it('Form a group with valid STAR offer structure', async () => {
    const lobby = nextLobby(),
      [mySocket, { id: myId }] = await joinLobby(http, server, 'mo', lobby),
      [otherSocket, { id: otherId }] = await joinLobby(http, server, 'momo', lobby),
      [guestSocket, { id: guestId }] = await joinLobby(http, server, 'mothepro', lobby)

    mySocket.sendProposal(true, otherId, guestId)
    otherSocket.sendProposal(true, myId, guestId)
    guestSocket.sendProposal(true, myId, otherId)

    const [
      { ids: myGroupIDs, cmp: myCmp },
      { ids: otherGroupIDs, cmp: otherCmp },
      { ids: guestGroupIDs, cmp: guestCmp },
    ] = await Promise.all([
      mySocket.groupFinal.next,
      otherSocket.groupFinal.next,
      guestSocket.groupFinal.next,
    ])

    // TODO This way of testing sucks...
    const me = myGroupIDs.map(other => myCmp < other),
      other = otherGroupIDs.map(other => otherCmp < other),
      guest = guestGroupIDs.map(other => guestCmp < other)

    // Makes sure that each only sends to offer to one that is waiting for offer
    // hardcoded since IDs are always ascending atm...
    me.should.eql([true, true])
    other.should.eql([true, false])
    guest.should.eql([false, false])
  })

  it('Notify lobby clients when group is formed', async () => {
    const lobby = nextLobby(),
      [mySocket, { id: myId }] = await joinLobby(http, server, 'mo', lobby),
      [otherSocket, { id: otherId }] = await joinLobby(http, server, 'momo', lobby),
      [guestSocket] = await joinLobby(http, server, 'guest', lobby)

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
    const lobby = nextLobby(),
      [mySocket, { id: myId }] = await joinLobby(http, server, 'mo', lobby),
      [otherSocket, { id: otherId }] = await joinLobby(http, server, 'momo', lobby)

    mySocket.sendProposal(true, otherId)
    otherSocket.sendProposal(true, myId)

    await Promise.all([
      mySocket.groupFinal.next,
      otherSocket.groupFinal.next,
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
    const lobby = nextLobby(),
      [mySocket, myClient] = await joinLobby(http, server, 'mo', lobby),
      [otherSocket, otherClient] = await joinLobby(http, server, 'momo', lobby)

    mySocket.sendProposal(true, otherClient.id)
    otherSocket.sendProposal(true, myClient.id)
    await Promise.all([
      // Group made
      mySocket.groupFinal.next,
      otherSocket.groupFinal.next,

      // Sockets closed
      mySocket.close.event,
      otherSocket.close.event,
    ])

    myClient.stateChange.isAlive.should.be.false()
    otherClient.stateChange.isAlive.should.be.false()
    mySocket.readyState.should.eql(CLOSED)
    otherSocket.readyState.should.eql(CLOSED)
  })

  it('Leaves all other groups once syncing', async () => {
    const lobby = nextLobby(),
      [socket0, client0] = await joinLobby(http, server, 'mo', lobby),
      [socket1, client1] = await joinLobby(http, server, 'momo', lobby),
      [socket2] = await joinLobby(http, server, 'mothepro', lobby)

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
