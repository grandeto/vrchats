require('dotenv').config()
const SHA512 = require("crypto-js/sha512")
const fs = require('fs')

const express = require("express")
const app = express()
const httpsServer = require("https").createServer({
  key: fs.readFileSync(process.env.PRIV_KEY_PATH),
  cert: fs.readFileSync(process.env.PUB_KEY_PATH)
}, app)

const ioOptions = {
    serveClient: false,
    cors: {
        origin: allowedOrigins(),
        methods: ["GET", "POST"]
      }
}
const io = require('socket.io')(httpsServer, ioOptions)
const ioTokenRenewInterval = isNaN(+process.env.IO_TOKEN_RENEW_INTERVAL) || typeof +process.env.IO_TOKEN_RENEW_INTERVAL != 'number' ? 86400000 : +process.env.IO_TOKEN_RENEW_INTERVAL
var ioTokenRenewStartHour = +process.env.IO_TOKEN_RENEW_START_HOUR
var ioToken = ioTokenHash(yearMonthDay())


app.use(express.json())

app.get('/', (req, res) => {
    res.send('OK')
})

app.post('/', (req, res) => {
    let to_uuid = req.body.to_uuid

    delete req.body['from_uuid']
    delete req.body['to_uuid']

    io.emit(to_uuid, req.body)

    res.send('OK')
})

io.use((socket, next) => {
    if (socket.handshake.auth.token != ioToken) {
        console.log('auth token error')
        next(new Error("invalid token"))
    } else {
        console.log('connected', socket.handshake.headers.origin + ':' + socket.handshake.address)
        next()
    }
})

httpsServer.listen(3000, () => {
    console.log('Listening...')
})

scheduleIoTokenRenew()

///// helpers /////

function allowedOrigins() {
    return process.env.ALLOWED_ORIGINS.split(',')
}

setInterval(function() {
    try {
        if (global.gc) {
            global.gc()
        }
    } catch (e) {
        console.error('global.gc error')
        console.log("`node --nouse-idle-notification --expose-gc --max-old-space-size=8192 app.js`")
        process.exit()
    }
}, 30000)

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
    ioToken = ioTokenHash(yearMonthDay(true))

    setInterval(function() {
        ioToken = ioTokenHash(yearMonthDay(true))
    }, ioTokenRenewInterval)
}

function ioTokenHash(date) {
    return SHA512(process.env.SECRET + date).toString()
}

function yearMonthDay() {
    let date = new Date()
    return date.getUTCFullYear() + '-' + (date.getUTCMonth()+1)  + '-' + date.getUTCDate()
}
