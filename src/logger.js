const path = require('path');

function init() {
    const { createLogger, transports, format } = require('winston')
    require('winston-daily-rotate-file')
    const logger = createLogger({
        level: 'info',
        defaultMeta: {serverStarted: new Date().toISOString(), pid: process.pid},
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

function fileTransportLogsOpts(name, opts = {}) {
    return Object.assign({
            dirname: path.normalize(process.env.LOGS_DIR),
            filename: name + '-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '30d',
            utc: true}, opts)
}

module.exports = {
    metadata,
    init
}
