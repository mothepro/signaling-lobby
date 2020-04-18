#!/usr/bin/env node
import { setLevel } from './src/util/logger'
import { verbose, port, maxLength, maxConnections, maxPayload, idleTimeout, syncTimeout } from './src/args'
import Server from './src/Server'

setLevel(verbose)
new Server({ port, maxPayload, maxConnections, maxLength, idleTimeout, syncTimeout })
