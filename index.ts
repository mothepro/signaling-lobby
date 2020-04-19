#!/usr/bin/env node
import { verbose, port, maxLength, maxConnections, idleTimeout, syncTimeout } from './src/args'
import http from './src/http'

http(verbose, port, maxLength, maxConnections, idleTimeout, syncTimeout)
