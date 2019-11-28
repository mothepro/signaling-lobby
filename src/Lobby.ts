import { LobbyID, ClientID } from './messages'
import Client, { State } from './Client'

export default class {
  private readonly clients: Map<ClientID, Client> = new Map

  addClient(client: Client) {
    this.clients.set(client.id, client)

    //

    this.clientPossibleGroupChange(client)

    // Remove dead clients
    for await (const state of client.stateChange)
      if (state == State.DEAD)
        this.clients.delete(client.id)
  }

  private async clientPossibleGroupChange(client: Client) {
    for await (const id of client.message)
  }

  private broadcast(data: ArrayBuffer) {
    
  }
}
