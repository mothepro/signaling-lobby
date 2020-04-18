import { LobbyID, Name } from '../../src/messages'
import Server from '../../src/Server'
import BrowserSocket from './BrowserSocket'
import { buildIntro } from './builders'
import { State } from '../../src/Client'

/** 
 * Helper to connect a client to a lobby
 * 
 * Note: Do not run in a parallel multiple times (`Promise.all`),
 *  since the client is just the next connection to the server.
 */
export default async function (server: Server, lobby: LobbyID, name: Name) {
  const socket = new BrowserSocket(server),
    client = await server.connection.next

  for await (const state of client.stateChange)
    switch (state) {
      case State.CONNECTED:
        await socket.open.event
        socket.send(buildIntro(lobby, name))
        break

      case State.IN_LOBBY:
        return [ socket, client ] as const

      default:
        throw Error('Client reached an unexpected state before reaching the lobby')
    }
  
  throw Error('The State emitter should not finish')
}
