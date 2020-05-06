import Client, { State } from './Client'
import logger, { Level } from '../util/logger'
import Group from './Group'
import { clientJoin, clientLeave, LobbyID, ClientID } from './messages'

/** Map that points to all the lobbies with clients still in it. */
const lobbies: Map<LobbyID, Set<Client>> = new Map

/** All the clients in lobbies */
const clients: Map<ClientID, Client> = new Map

/** Gets a lobby with the given ID. Creates a new Lobby if one doesn't exist. */
export default async function (lobbyId: LobbyID, client: Client) {
  if (!lobbies.has(lobbyId)) {
    logger(Level.INFO, 'Creating lobby', lobbyId)
    lobbies.set(lobbyId, new Set)
  }

  logger(Level.INFO, client.id, '> joined lobby', lobbyId, 'as', client.name)
  const members = lobbies.get(lobbyId)!

  // Tell everyone else about me & tell me about everyone else
  for (const other of members) {
    other.send(clientJoin(client))
    client.send(clientJoin(other))
  }

  // Add new client to list
  members.add(client)
  clients.set(client.id, client)

  client.proposal.on(({ approve, ids }) => { // use `on` since `for-await-of` can't overlap
    if (approve) {
      const participants = []

      // TODO, make this a one liner
      for (const clientId of ids)
        if (clients.has(clientId) && clientId != client.id)
          participants.push(clients.get(clientId)!)
        else
          // TODO decide if client should be kicked for this
          logger(Level.DEBUG, client.id, '> tried to add some non-existent members to group', ids)

      // TODO decide if client should be kicked for this
      if (!participants.length)
        logger(Level.DEBUG, client.id, '> Tried to make a group without members')

      Group.make(client, ...participants)
    }
  })

  // Remove dead or syncing clients
  try {
    for await (const state of client.stateChange)
      if (state == State.SYNCING)
        break
  } catch { } // Handled in Client's constructor

  members.delete(client)

  // Notify for client leaving on the next tick to allow dead clients to be removed first
  setImmediate(() => {
    for (const other of members)
      other.send(clientLeave(client))
  })

  if (!members.size) {
    logger(Level.DEBUG, 'Removing empty lobby', lobbyId)
    lobbies.delete(lobbyId)
  }
}
