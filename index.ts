#!/usr/bin/env node
import { verbose, port, maxLength, maxConnections, idleTimeout, syncTimeout, key, cert } from './src/args'
import http from './src/start'

http(verbose, port, maxLength, maxConnections, idleTimeout, syncTimeout, key, cert)
