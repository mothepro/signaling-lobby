import { Listener } from 'fancy-emitter'
import { Name } from '../../src/messages'
import Client, { State } from '../../src/Client'
import BrowserSocket from './BrowserSocket'
import { Server } from 'http'

let lobbyId = 0

/** Gets a lobby that is currently unused. */
export const nextLobby = () => lobbyId++

/** 
 * Helper to create a browser socket and connect it to a lobby.
 * Returns with the browser socket and the `Client` used on the server once connected to the lobby.
 * 
 * Note: Do not run in a parallel multiple times (`Promise.all`).
 *  This is because the `Client` is just the next connection to the server.
 */
export default async function (http: Server, server: Listener<Client>, name: Name, lobby = nextLobby()) {
  const socket = new BrowserSocket(http),
    client = await server.next

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
