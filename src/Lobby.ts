import { ClientID } from './util/messages'
import Client, { State } from './Client'
import { SafeEmitter } from 'fancy-emitter'
import logger, { Level } from './util/logger'

export default class {
  private readonly clients: Map<ClientID, Client> = new Map

  
  
  private broadcast(data: any, clients = this.clients.values()) {
    for (const client of clients)
      client.send(JSON.stringify(data))
  }

  readonly clientJoin = new SafeEmitter<Client>(
    // Tell everyone else
    ({ id, name }) => this.broadcast({ join: true, id, name }),

    // Add new client to list
    client => this.clients.set(client.id, client),

    // Message from browser
    async ({ id, message, state }) => {
      for await (const data of message)
        switch (state) {
          case State.IN_LOBBY:
            logger(Level.INFO, id, '> invs ', data, state)
        }
    },

    // Remove dead clients
    async ({ id, stateChange }) => {
      for await (const state of stateChange)
        if (state == State.DEAD) {
          this.clients.delete(id)
          this.broadcast({ join: false, id })
        }
    }
  )
}
