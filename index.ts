#!/usr/bin/env node
import createServer from './src/createServer'
import { setLevel } from './src/util/logger'
import { verbose, port, maxLength, maxConnections, maxPayload, idleTimeout } from './src/args'

setLevel(verbose)
createServer(port, maxPayload, maxConnections, maxLength, idleTimeout)
