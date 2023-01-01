const utils = require('./src/utils.js')
const log = require('./src/logger.js')
const logger = log.init()
const { readFileSync } = require('fs')
const { isIP, inRange } = require('range_check')
const { RateLimiterMemory } = require('rate-limiter-flexible')
const rateLimiter = new RateLimiterMemory({
    // TODO: get from env
    points: 1, // points
    duration: 1, // per second
})

const httpHandler = require('express')
const { Server } = require('socket.io')

const httpUtils = {
    utils: utils,
    logger: logger,
    log: log,
    isIP: isIP,
    inRange: inRange,
    parser: httpHandler.json(),
    eventIDValidator: utils.eventIDValidator()
}

const httpOpts = {
    key: readFileSync(utils.privKeyPath()),
    cert: readFileSync(utils.pubKeyPath()),
    ca: readFileSync(utils.caPath()),
    requestCert: utils.verifyOrigin()
}

const webSocketServer = require('./src/websocket/server.js')
const webSocketListener = webSocketServer.createServer(httpOpts, httpHandler())
const webSocketOpts = {
    serveClient: false,
    cors: {
        origin: utils.trustOriginList(),
        methods: ['GET', 'POST']
    }
}
const webSocketHandler = new Server(webSocketListener, webSocketOpts)

const httpServer = require('./src/http/server.js')
httpServer.start(httpServer.createServer, httpHandler(), httpOpts, httpUtils, webSocketHandler)

const webSocketUtils = {
    utils: utils,
    logger: logger,
    log: log,
    rateLimiter: rateLimiter
}

webSocketServer.start(webSocketHandler, webSocketListener, webSocketUtils)

// GC
setInterval(function() {
    try {
        if (global.gc) {
            global.gc()
        }
    } catch (e) {
        logger.error('global.gc error', log.metadata())
        process.exit()
    }
}, 30000)
