import { Server } from 'http'
import { Name } from '../../src/messages'
import SocketServer from '../../src/SocketServer'
import { State } from '../../src/Client'
import BrowserSocket from './BrowserSocket'

let lobbyId = 0

/** Gets a lobby that is currently unused. */
export const nextLobby = () => lobbyId++

/** 
 * Helper to connect a client to a lobby
 * 
 * Note: Do not run in a parallel multiple times (`Promise.all`),
 *  since the client is just the next connection to the server.
 */
export default async function (http: Server, server: SocketServer, name: Name, lobby = nextLobby()) {
  const socket = new BrowserSocket(http),
    client = await server.connection.next

  for await (const state of client.stateChange)
    switch (state) {
      case State.CONNECTED:
        await socket.open.event
        socket.sendIntro(lobby, name)
        break

      case State.IN_LOBBY:
        return [socket, client] as const

      default:
        throw Error('Client reached an unexpected state before reaching the lobby')
    }

  throw Error('The State emitter should not finish')
}
