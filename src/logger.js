const path = require('path');

function init() {
    const { createLogger, transports, format } = require('winston')
    const logger = createLogger({
        level: 'info',
        defaultMeta: {serverStarted: new Date().toISOString(), pid: process.pid},
        format: format.json(),
        transports: [
            new transports.Console(),
        ],
        exitOnError: false
    })

    return logger
}

function metadata(req = undefined, data = {}) {
    let metadata = {timestamp: new Date().toISOString()}

    if (req) {
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

        metadata.forwardedIp = forwardedIp
        metadata.remoteIp = remoteIp
    }

    return Object.assign(metadata, data)
}

module.exports = {
    metadata,
    init
}
