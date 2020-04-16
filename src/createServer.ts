
import * as WebSocket from 'ws'
import { LobbyID } from './messages'
import Client, { State } from './Client'
import Lobby from './Lobby'
import openId from './util/openId'
import logger, { Level } from './util/logger'

// TODO add DoS prevention use
// potenetially using 'headers' event and & shouldHandle method
export default function (
  port: number,
  maxPayload: number,
  maxConnections: number,
  maxNameLength: number,
  idleTimeout: number,
  // Possibly the same as connections
  backlog = maxConnections,
) {
  // All clients not in a lobby
  const pendingClients = new Set<Client>(),
    // Lobbies currently in use
    lobbies = new Map<LobbyID, Lobby>(),
    // Create available IDs for the clients
    ids = openId(0xFFFF),
    // The web server
    host = new WebSocket.Server({ port, backlog, maxPayload, clientTracking: false, perMessageDeflate: false }) as
      WebSocket.Server & { clientCount: number }

  Object.defineProperty(host, 'clientCount', {
    get: () => [...lobbies.values()]
      .reduce((prev, curr) => prev + curr.clientCount, 0)
      + pendingClients.size
  })

  host.on('listening', () => logger(Level.USEFUL, 'Signaling server initiated', host.address()))
  host.on('close', () => logger(Level.USEFUL, 'Shutting down the signaling server'))
  host.on('error', err => logger(Level.SEVERE, 'An error occurred with the signaling server', err) && host.close())
  host.on('connection', async (socket: WebSocket) => {
    if (host.clientCount < maxConnections) {
      const client = new Client(ids.next().value, socket, maxNameLength, idleTimeout)

      for await (const state of client.stateChange)
        switch (state) {
          case State.CONNECTED:
            pendingClients.add(client)
            break

          // Prepares a lobby of a specific ID and adds client to it
          case State.IN_LOBBY:
            if (!lobbies.has(client.lobby!))
              logger(Level.INFO, 'Creating lobby', client.lobby)
                && lobbies.set(client.lobby!, new Lobby)
            lobbies.get(client.lobby!)!.clientJoin.activate(client)
            logger(Level.INFO, client.id, '> joined lobby', client.lobby, 'as', client.name)
          // fall-thru

          case State.DEAD:
            pendingClients.delete(client)
            break
          // return // We no longer care for status updates?
        }
    } else {
      logger(Level.USEFUL, 'This server is already at its max connections', maxConnections)
      socket.close()
    }
  })

  return host
}