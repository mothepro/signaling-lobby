import { CLOSED } from 'ws'
import { State } from '../src/Client'
import { buildIntro } from './util/builders'
import ClientSocket from "./util/ClientSocket"
import Server from '../src/Server'

describe('Lobby', () => {
  let server: Server

  beforeEach(() => server = new Server)

  afterEach(() => server.close.activate())

  it('Ignores non-intros before lobby', async () => {
    await server.listening.event
    const socket = new ClientSocket(server),
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
    const socket = new ClientSocket(server),
      client = await server.connection.next

    for await (const state of client.stateChange)
      switch (state) {
        case State.CONNECTED:
          await socket.open.event
          socket.send(buildIntro(123, 'mo'))
          break

        case State.IN_LOBBY:
          client.lobby!.should.eql(123)
          client.name!.should.eql('mo')
          return
      }
  })
})
