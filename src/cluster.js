const helpers = require('./helpers.js')
const log = require('./log.js')
const logger = log.loggerInit()
const { readFileSync } = require('fs')
var ioToken

logger.info('Cluster node init', log.loggerMetadata())

// express
const express = require('express')
const app = express()

// https server
const { createServer } = require('https')
let httpsOpts = {
    key: readFileSync(helpers.privKeyPath()),
    cert: readFileSync(helpers.pubKeyPath())
}
if (process.env.VERIFY_ORIGIN == 1) {
    httpsOpts.ca = readFileSync(helpers.caPath())
    httpsOpts.requestCert = true
}
const httpsServer = createServer(httpsOpts, app)

// express config
app.set('x-powered-by', false)
if (process.env.USE_PROXY == 1) {
    app.set('trust proxy', process.env.TRUST_PROXY || true)
}

// events API
function socketProducerInit() {
    logger.info('socketProducer init', log.loggerMetadata())

    const { isIP, inRange } = require('range_check')

    // gc config
    setInterval(function() {
        try {
            if (global.gc) {
                global.gc()
            }
        } catch (e) {
            logger.error('global.gc error', log.loggerMetadata())
            process.exit()
        }
    }, 30000)

    // events API middleware
    app.use((req, res, next) => {
        let allowedIps = process.env.ALLOWED_IPS.split(','),
            trustProxy = process.env.TRUST_PROXY.split(','),
            ip = helpers.fetchV4Ip(req.socket.remoteAddress)

        if (process.env.USE_PROXY == 1) {
            let proxyIp = ip
            ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']

            if (!isIP(proxyIp) || !isIP(ip)) {
                logger.error('invalid proxy_ip or ip', log.loggerMetadata(req))
                res.status(403).send('Forbidden')
            } else if (!inRange(proxyIp, trustProxy) || !inRange(ip, allowedIps)) {
                // in case app is behind cloudflare, add cloudflare's ip ranges in .env TRUST_PROXY
                logger.error('untrusted proxy_ip or ip', log.loggerMetadata(req))
                res.status(403).send('Forbidden')
            } else {
                next()
            }
        } else {
            if (!isIP(ip) || !inRange(ip, allowedIps)) {
                logger.error('invalid or untrusted ip', log.loggerMetadata(req))
                res.status(403).send('Forbidden')
            } else {
                next()
            }
        }
    })

    app.use(express.json())

    // API monitoring
    app.get('/', (req, res) => {
        logger.info("GET", log.loggerMetadata(req))
        res.status(200).send('OK')
    })

    // handle events
    app.post('/', (req, res) => {
        if (new RegExp('^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$').test(req.body.uuid)) {
            process.send({
                type : 'process:msg',
                data : req.body
            })
        } else {
            logger.error('Invalid to.uuid', log.loggerMetadata(req, {
                toUiid: req.body.to.uuid,
                fromId: req.body.from.id
            }))
        }

        res.status(200).send('OK')
    })

    // handle errors
    app.use((err, req, res, next) => {
        logger.error('req/res error', log.loggerMetadata(req, {stack: err.stack}))
        res.status(500).send('ISE')
    })

    // producers listening
    httpsServer.listen(+process.env.PRODUCER_PORT || 2053, () => {
        logger.info('Listening...' + process.env.PRODUCER_PORT, log.loggerMetadata())
    })

    logger.info('socketProducer initialized', log.loggerMetadata())
}

// subscribers endpoint
function socketConsumerInit(msgBuss) {
    logger.info('socketConsumer init', log.loggerMetadata())

    // socket.io auth token bootstrap
    ioToken = helpers.ioTokenHash()

    let ioTokenRenewInterval = isNaN(+process.env.IO_TOKEN_RENEW_INTERVAL) || typeof +process.env.IO_TOKEN_RENEW_INTERVAL != 'number' ? 86400000 : +process.env.IO_TOKEN_RENEW_INTERVAL
    let ioTokenRenewStartHour = +process.env.IO_TOKEN_RENEW_START_HOUR
    let time = new Date()

    ioTokenRenewStartHour = isNaN(ioTokenRenewStartHour) || (ioTokenRenewStartHour < 0 || ioTokenRenewStartHour > 23) ? time.getUTCHours() : ioTokenRenewStartHour
    ioTokenRenewStartHour = ioTokenRenewStartHour === 0 ? 24 : ioTokenRenewStartHour
    ioTokenRenewStartHour = ioTokenRenewStartHour <= time.getUTCHours() ? (time.getUTCHours()+1) : ioTokenRenewStartHour
    time.setUTCHours(ioTokenRenewStartHour, 0, 0, 0)
    let timeToNextIoTokenRenewInterval = time.getTime() - new Date().getTime()

    setTimeout(function() {
        ioToken = helpers.ioTokenHash()
        setInterval(function() {
            ioToken = helpers.ioTokenHash()
        }, ioTokenRenewInterval)
    }, timeToNextIoTokenRenewInterval)

    // rate limit
    const { RateLimiterMemory } = require('rate-limiter-flexible')
    const rateLimiter = new RateLimiterMemory({
        points: 1, // points
        duration: 1, // per second
    })

    // socket.io init
    const ioOptions = {
        serveClient: false,
        cors: {
            origin: helpers.allowedOrigins(),
            methods: ['GET', 'POST']
          }
    }
    const { Server } = require('socket.io')
    const io = new Server(httpsServer, ioOptions)

    // socket.io middleware
    io.use(async (socket, next) => {
        // consume 1 point per event from user id
        let hasToBeLimited = await rateLimiter.consume(socket.handshake.query.uniqueUserId)
                                .then(_ => {
                                    return false
                                })
                                .catch(_ => {
                                    return true
                                })

        if (hasToBeLimited) {
            logger.error('rate limit block', log.loggerMetadata(socket.handshake, {uniqueUserId: socket.handshake.query.uniqueUserId}))
            next(new Error('rate limit block'))
        } else if (socket.handshake.auth.token != ioToken) {
            logger.error('auth token error', log.loggerMetadata(socket.handshake, {
                token: ioToken,
                tokenReceived: socket.handshake.auth.token,
                uniqueUserId: socket.handshake.query.uniqueUserId
            }))
            next(new Error('invalid token'))
        } else {
            logger.info('connected', log.loggerMetadata(socket.handshake, {
                origin: socket.handshake.headers.origin,
                uniqueUserId: socket.handshake.query.uniqueUserId
            }))
            next()
        }
    })

    // consumers listening
    httpsServer.listen(+process.env.CONSUMER_PORT || 8443, () => {
        logger.info('Listening...' + process.env.CONSUMER_PORT, log.loggerMetadata())
    })

    // msg emitter
    msgBuss.on('process:msg', function(packet) {
        let to = packet.data.uuid
        delete packet.data.uuid
        io.emit(to, packet.data)
    })

    logger.info('socketConsumer initialized', log.loggerMetadata())
}

module.exports = {
    socketProducerInit,
    socketConsumerInit,
}
