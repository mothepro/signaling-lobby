import { SingleEmitter, Emitter, Listener } from 'fancy-emitter'
import { Server, IncomingMessage } from 'http'
import { Socket } from 'net'
import { parse } from 'url'
import * as WebSocket from 'ws'
import Client from './Client'
import openId from '../util/openId'
import { logErr } from '../util/logger'
import { Max, ClientID } from '../util/constants'
import stringSantizer from '../util/stringSantizer'

/** Create available IDs for the clients */
const availableId = openId(Max.SHORT)

/** 
 * Binds an HTTP(S) server to a WebSocket server to create a lobby system.
 * 
 * Resolves with an emitter which actives with every new client.
 * The emitter is canceled once no more clients are connecting.
 */
// TODO add DoS prevention use
export default async function (
  { maxConnections, maxSize, maxLength, idleTimeout, syncTimeout, anonymousPrefix }:
    {
      maxConnections: number
      maxSize: number
      maxLength: number
      idleTimeout: number
      syncTimeout: number
      anonymousPrefix?: string,
    },
  /** The underlying HTTP(S) connection server. */
  httpServer: Server,
  /** The optional protocol that the client must specify to be accepted. */
  protocol?: string,
  /** The underlying WebSocket server. */
  socketServer = new WebSocket.Server({ noServer: true }),
) {
  const allClients: Map<ClientID, Client> = new Map,

    /** Activated when server is ready to receive connections. */
    ready: SingleEmitter<Listener<Client>> = new SingleEmitter,

    /**
     * Activated when a socket successfully connectes to the server.
     * Save & remove client from list of all clients.
     */
    connection = new Emitter<Client>(async client => {
      try {
        allClients.set(client.id, client)
        for await (const _ of client.stateChange);
      } catch { } // Handled in Client's constructor 
      allClients.delete(client.id)
    })

  httpServer.once('close', connection.cancel)
  httpServer.once('close', socketServer.close)
  httpServer.once('error', connection.deactivate)
  httpServer.once('error', ready.deactivate)
  httpServer.once('listening', () => ready.activate(connection))
  httpServer.on('upgrade', (request: IncomingMessage, socket: Socket, head: Buffer) => {
    if (protocol && request.headers['sec-websocket-protocol'] != protocol) {
      logErr('Server requires the protocol', protocol,
        'but client attempted to conntect with', request.headers['sec-websocket-protocol'])
      socket.destroy()
      return
    }

    if (maxConnections && allClients.size >= maxConnections) {
      logErr('This server is already at its max connections', maxConnections)
      socket.destroy()
      return
    }

    const { query: { lobby, name } } = parse(request.url!, true),
      realName = stringSantizer(name?.toString(), maxLength)

    if (!lobby) {
      logErr('Lobby must be specified to connect to the signaling server')
      socket.destroy()
      return
    }

    if (!anonymousPrefix && !realName) {
      logErr('Expected a valid name must be given on initialization when `anonymous` is not set, got', name)
      socket.destroy()
      return
    }

    socketServer.handleUpgrade(request, socket, head, webSocket => connection.activate(
      new Client(
        availableId.next().value,
        realName,
        lobby.toString(),
        webSocket as WebSocket,
        maxSize,
        idleTimeout,
        syncTimeout,
        anonymousPrefix ?? '',
        (id: ClientID) => allClients.get(id))))
  })

  if (httpServer.listening)
    return connection

  return ready.event
}
