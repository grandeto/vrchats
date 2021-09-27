require('dotenv').config()

const { createLogger, transports, format } = require('winston')
require('winston-daily-rotate-file')
const logger = createLogger({
    level: 'info',
    defaultMeta: {timestamp: new Date().toISOString(), pid: process.pid},
    format: format.json(),
    transports: [
        new transports.DailyRotateFile(fileTransportLogsOpts('error', {level: 'error'})),
        new transports.DailyRotateFile(fileTransportLogsOpts('combined')),
    ],
    exceptionHandlers: [
        new transports.DailyRotateFile(fileTransportLogsOpts('exceptions'))
    ],
    rejectionHandlers: [
        new transports.DailyRotateFile(fileTransportLogsOpts('rejections'))
    ],
    exitOnError: false
})
if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
        format: format.simple(),
    }))
}

const SHA512 = require('crypto-js/sha512')
const { readFileSync } = require('fs')
const { isIP, inRange } = require('range_check')

const express = require('express')
const app = express()

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

const ioOptions = {
    serveClient: false,
    cors: {
        origin: allowedOrigins(),
        methods: ['GET', 'POST']
      }
}
const { Server } = require('socket.io')
const io = new Server(httpsServer, ioOptions)

const ioTokenRenewInterval = isNaN(+process.env.IO_TOKEN_RENEW_INTERVAL) || typeof +process.env.IO_TOKEN_RENEW_INTERVAL != 'number' ? 86400000 : +process.env.IO_TOKEN_RENEW_INTERVAL

const { RateLimiterMemory } = require('rate-limiter-flexible')
const rateLimiter = new RateLimiterMemory({
    points: 1, // points
    duration: 1, // per second
})

var ioTokenRenewStartHour = +process.env.IO_TOKEN_RENEW_START_HOUR
var ioToken = ioTokenHash(yearMonthDay())

// express //

app.set('x-powered-by', false)

if (process.env.USE_PROXY == 1) {
    app.set('trust proxy', process.env.TRUST_PROXY || true)
}

app.use((req, res, next) => {
    let allowedIps = process.env.ALLOWED_IPS.split(','),
        trustProxy = process.env.TRUST_PROXY.split(','),
        ip = fetchV4Ip(req.socket.remoteAddress)

    if (process.env.USE_PROXY == 1) {
        let proxyIp = ip
        ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']

        if (!isIP(proxyIp) || !isIP(ip)) {
            logger.error('invalid proxy_ip or ip', loggerMetadata(req))
            res.status(403).send('Forbidden')
        } else if (!inRange(proxyIp, trustProxy) || !inRange(ip, allowedIps)) {
            // in case app is behind cloudflare, add cloudflare's ip ranges in .env TRUST_PROXY
            logger.error('untrusted proxy_ip or ip', loggerMetadata(req))
            res.status(403).send('Forbidden')
        } else {
            next()
        }
    } else {
        if (!isIP(ip) || !inRange(ip, allowedIps)) {
            logger.error('invalid or untrusted ip', loggerMetadata(req))
            res.status(403).send('Forbidden')
        } else {
            next()
        }
    }
})

app.use(express.json())

app.get('/', (req, res) => {
    res.status(200).send('OK')
})

app.post('/', (req, res) => {
    if (new RegExp('^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$').test(req.body.to.uuid)) {
        io.emit(req.body.to.uuid, {
            from: {
                id: req.body.from.id
            },
            to: {},
            msg: req.body.msg
        })
    } else {
        logger.error('Invalid to.uuid', loggerMetadata(req, {
            toUiid: req.body.to.uuid,
            fromId: req.body.from.id
        }))
    }

    res.status(200).send('OK')
})

app.use((err, req, res, next) => {
    logger.error('req/res error', loggerMetadata(req, {stack: err.stack}))
    res.status(500).send('ISE')
})

// socket.io //

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
        logger.error('rate limit block', loggerMetadata(socket.handshake, {uniqueUserId: socket.handshake.query.uniqueUserId}))
        next(new Error('rate limit block'))
    } else if (socket.handshake.auth.token != ioToken) {
        logger.error('auth token error', loggerMetadata(socket.handshake, {
            token: ioToken,
            tokenReceived: socket.handshake.auth.token,
            uniqueUserId: socket.handshake.query.uniqueUserId
        }))
        next(new Error('invalid token'))
    } else {
        logger.info('connected', loggerMetadata(socket.handshake, {
            origin: socket.handshake.headers.origin,
            uniqueUserId: socket.handshake.query.uniqueUserId
        }))
        next()
    }
})

// init //

httpsServer.listen(process.env.PORT, () => {
    logger.info('Listening...')
})

scheduleIoTokenRenew()

setInterval(function() {
    try {
        if (global.gc) {
            global.gc()
        }
    } catch (e) {
        logger.error('global.gc error')
        console.log("`node --nouse-idle-notification --expose-gc --max-old-space-size=8192 app.js`")
        process.exit()
    }
}, 30000)

// helpers //

function fetchV4Ip(ip) {
    return ip.substr(0, 7) == '::ffff:' ? ip.substr(7) : ip
}

function allowedOrigins() {
    return process.env.ALLOWED_ORIGINS.split(',')
}

function scheduleIoTokenRenew() {
    let time = new Date()

    ioTokenRenewStartHour = isNaN(ioTokenRenewStartHour) || (ioTokenRenewStartHour < 0 || ioTokenRenewStartHour > 23) ? time.getUTCHours() : ioTokenRenewStartHour
    ioTokenRenewStartHour = ioTokenRenewStartHour === 0 ? 24 : ioTokenRenewStartHour
    ioTokenRenewStartHour = ioTokenRenewStartHour <= time.getUTCHours() ? (time.getUTCHours()+1) : ioTokenRenewStartHour

    time.setUTCHours(ioTokenRenewStartHour, 0, 0, 0)

    let timeToNextIoTokenRenewInterval = time.getTime() - new Date().getTime()

    setTimeout(renewIoToken, timeToNextIoTokenRenewInterval)
}

function renewIoToken() {
    ioToken = ioTokenHash(yearMonthDay())

    setInterval(function() {
        ioToken = ioTokenHash(yearMonthDay())
    }, ioTokenRenewInterval)
}

function ioTokenHash(date) {
    return SHA512(process.env.AUTH_TOKEN_SECRET + date).toString()
}

function yearMonthDay() {
    let date = new Date()
    return date.getUTCFullYear() + '-' + (date.getUTCMonth()+1)  + '-' + date.getUTCDate()
}

function fileTransportLogsOpts(name, opts = {}) {
    return Object.assign({
            dirname: './logs',
            filename: name + '-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '30d',
            utc: true}, opts)
}

function loggerMetadata(req, data = {}) {
    let forwardedIp, remoteIp

    if (!req.hasOwnProperty('headers')) {
        forwardedIp = null
    } else if (req['headers'].hasOwnProperty('cf-connecting-ip')) {
        forwardedIp = req['headers']['cf-connecting-ip']
    } else if (req['headers'].hasOwnProperty('x-forwarded-for')) {
        forwardedIp = req['headers']['x-forwarded-for']
    } else {
        forwardedIp = null
    }

    if (req.hasOwnProperty('socket')) {
        remoteIp = req.socket.remoteAddress
    } else if (req.hasOwnProperty('address')) {
        remoteIp = req['address']
    } else {
        remoteIp = null
    }

    return Object.assign({
        forwardedIp: forwardedIp,
        remoteIp: remoteIp,
    }, data)
}
