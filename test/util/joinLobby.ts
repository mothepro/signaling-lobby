import { Listener, filterValue } from 'fancy-emitter'
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
  const socket = new BrowserSocket(http, lobby, name),
    client = await server.next

  // wait for readiness on client and server side
  await Promise.all([
    filterValue(client.stateChange, State.CONNECTED),
    socket.open.event,
  ])

  return [socket, client] as const
}
