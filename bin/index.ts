#!/usr/bin/env node
import { verbose, hostname, port, maxLength, maxConnections, idleTimeout, syncTimeout, key, cert } from './args'
import start from './start'

start(verbose, hostname, port, maxLength, maxConnections, idleTimeout, syncTimeout, key, cert)
