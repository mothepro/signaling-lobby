#!/usr/bin/env node
import { verbose, port, maxLength, maxConnections, idleTimeout, syncTimeout, key, cert } from './src/args'
import start from './src/start'

start(verbose, port, maxLength, maxConnections, idleTimeout, syncTimeout, key, cert)
