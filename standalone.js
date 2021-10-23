function standaloneInit() {
    const helpers = require('./helpers.js')
    const logger = helpers.loggerInit()
    const { readFileSync } = require('fs')
    const { isIP, inRange } = require('range_check')
    var ioToken

    logger.info('Standalone node init', helpers.loggerMetadata())

    // rate limit
    const { RateLimiterMemory } = require('rate-limiter-flexible')
    const rateLimiter = new RateLimiterMemory({
        points: 1, // points
        duration: 1, // per second
    })

    // express
    const express = require('express')
    const app = express()

    // https server
    const { createServer } = require('https')
    var httpsOpts = {
        key: readFileSync(process.env.PRIV_KEY_PATH),
        cert: readFileSync(process.env.PUB_KEY_PATH)
    }
    if (process.env.VERIFY_ORIGIN == 1) {
        httpsOpts.ca = readFileSync(process.env.CA_PATH)
        httpsOpts.requestCert = true
    }
    const httpsServer = createServer(httpsOpts, app)

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

    // express config
    app.set('x-powered-by', false)
    if (process.env.USE_PROXY == 1) {
        app.set('trust proxy', process.env.TRUST_PROXY || true)
    }

    // events API

    app.use(express.json())

    // API middleware
    app.use((req, res, next) => {
        let allowedIps = process.env.ALLOWED_IPS.split(','),
            trustProxy = process.env.TRUST_PROXY.split(','),
            ip = helpers.fetchV4Ip(req.socket.remoteAddress)

        if (process.env.USE_PROXY == 1) {
            let proxyIp = ip
            ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']

            if (!isIP(proxyIp) || !isIP(ip)) {
                logger.error('invalid proxy_ip or ip', helpers.loggerMetadata(req))
                res.status(403).send('Forbidden')
            } else if (!inRange(proxyIp, trustProxy) || !inRange(ip, allowedIps)) {
                // in case app is behind cloudflare, add cloudflare's ip ranges in .env TRUST_PROXY
                logger.error('untrusted proxy_ip or ip', helpers.loggerMetadata(req))
                res.status(403).send('Forbidden')
            } else {
                next()
            }
        } else {
            if (!isIP(ip) || !inRange(ip, allowedIps)) {
                logger.error('invalid or untrusted ip', helpers.loggerMetadata(req))
                res.status(403).send('Forbidden')
            } else {
                next()
            }
        }
    })

    // API monitoring
    app.get('/', (req, res) => {
        res.status(200).send('OK')
    })

    // API events handler
    app.post('/', (req, res) => {
        if (new RegExp('^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$').test(req.body.uuid)) {
            let to = req.body.uuid
            delete req.body.uuid
            io.emit(to, req.body)
        } else {
            logger.error('Invalid to.uuid', helpers.loggerMetadata(req, {
                toUiid: req.body.to.uuid,
                fromId: req.body.from.id
            }))
        }

        res.status(200).send('OK')
    })

    // API error handler
    app.use((err, req, res, next) => {
        logger.error('req/res error', helpers.loggerMetadata(req, {stack: err.stack}))
        res.status(500).send('ISE')
    })

    // subscribers API

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
            logger.error('rate limit block', helpers.loggerMetadata(socket.handshake, {uniqueUserId: socket.handshake.query.uniqueUserId}))
            next(new Error('rate limit block'))
        } else if (socket.handshake.auth.token != ioToken) {
            logger.error('auth token error', helpers.loggerMetadata(socket.handshake, {
                token: ioToken,
                tokenReceived: socket.handshake.auth.token,
                uniqueUserId: socket.handshake.query.uniqueUserId
            }))
            next(new Error('invalid token'))
        } else {
            logger.info('connected', helpers.loggerMetadata(socket.handshake, {
                origin: socket.handshake.headers.origin,
                uniqueUserId: socket.handshake.query.uniqueUserId
            }))
            next()
        }
    })

    // init //

    httpsServer.listen(+process.env.STANDALONE_PORT || 8443, () => {
        logger.info('Listening...' + process.env.STANDALONE_PORT, helpers.loggerMetadata())
    })

    setInterval(function() {
        try {
            if (global.gc) {
                global.gc()
            }
        } catch (e) {
            logger.error('global.gc error', helpers.loggerMetadata())
            process.exit()
        }
    }, 30000)
}

module.exports = {
    standaloneInit
}
