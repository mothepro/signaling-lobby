#!/usr/bin/env node
import { verbose, hostname, port, maxLength, maxConnections, idleTimeout, syncTimeout, key, cert } from './src/args'
import start from './src/start'

start(verbose, hostname, port, maxLength, maxConnections, idleTimeout, syncTimeout, key, cert)
