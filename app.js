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
var ioToken = ioTokenHash(yearMonthDay())
const io = require('socket.io')(httpsServer, ioOptions)

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


io.on("connection", socket => {
    console.log("io con received", socket.handshake)
    console.log('test', socket.handshake.auth.token == ioToken)
    console.log('ioToken', ioToken)
})

httpsServer.listen(3000, () => {
    console.log('Listening...')
})

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

function callOnMidnight() {
    setInterval(function() {
        ioToken = ioTokenHash(yearMonthDay())
    }, 1000 * 24 * 60 * 60)
}

var nextMidnight = new Date()
if (nextMidnight.getUTCHours() === 0) {
    callOnMidnight()
} else {
    nextMidnight.setHours(0)
    nextMidnight.setMinutes(0)
    nextMidnight.setSeconds(0)

    let difference = nextMidnight - new Date()
    setTimeout(callOnMidnight, difference)
}

function ioTokenHash(date) {
    return SHA512(process.env.SECRET + date).toString()
}

function yearMonthDay() {
    let date = new Date()
    return date.getUTCFullYear() + '-' + (date.getUTCMonth()+1)  + '-' + date.getUTCDate()
}
