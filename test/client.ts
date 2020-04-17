import { State } from '../src/Client'
import { Max } from './util/constants'
import { buildIntro } from './util/builders'
import ClientSocket from "./util/ClientSocket"
import Server from '../src/Server'

describe('Client', () => {
  let server: Server

  beforeEach(() => server = new Server(0, Max.PAYLOAD, Max.CONNECTIONS, Max.NAME_LENGTH, Max.IDLE_TIME))

  afterEach(() => server.close.activate())

  it('Ignores non-intros before lobby')

  it('Connect to a lobby', async () => {
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
