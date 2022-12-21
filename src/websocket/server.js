const { createServer } = require('https')

function start(handler, listener, webSocketUtils) {
    const utils = webSocketUtils.utils
    const logger = webSocketUtils.logger
    const log = webSocketUtils.log
    const rateLimiter = webSocketUtils.rateLimiter

    // Subscribers API

    // websocket auth config - TODO move out
    let ioToken = utils.ioTokenHash()

    let ioTokenRenewInterval = isNaN(+process.env.IO_TOKEN_RENEW_INTERVAL) || typeof +process.env.IO_TOKEN_RENEW_INTERVAL != 'number' ? 86400000 : +process.env.IO_TOKEN_RENEW_INTERVAL
    let ioTokenRenewStartHour = +process.env.IO_TOKEN_RENEW_START_HOUR
    let time = new Date()

    ioTokenRenewStartHour = isNaN(ioTokenRenewStartHour) || (ioTokenRenewStartHour < 0 || ioTokenRenewStartHour > 23) ? time.getUTCHours() : ioTokenRenewStartHour
    ioTokenRenewStartHour = ioTokenRenewStartHour === 0 ? 24 : ioTokenRenewStartHour
    ioTokenRenewStartHour = ioTokenRenewStartHour <= time.getUTCHours() ? (time.getUTCHours()+1) : ioTokenRenewStartHour
    time.setUTCHours(ioTokenRenewStartHour, 0, 0, 0)
    let timeToNextIoTokenRenewInterval = time.getTime() - new Date().getTime()

    setTimeout(function() {
        ioToken = utils.ioTokenHash()
        setInterval(function() {
            ioToken = utils.ioTokenHash()
        }, ioTokenRenewInterval)
    }, timeToNextIoTokenRenewInterval)

    // websocket middleware
    handler.use(async (socket, next) => {
        // consume 1 point per event from user id
        let hasToBeLimited = await rateLimiter.consume(socket.handshake.query.uniqueUserId)
                                .then(_ => {
                                    return false
                                })
                                .catch(_ => {
                                    return true
                                })

        if (hasToBeLimited) {
            logger.error('rate limit block', log.metadata(socket.handshake, {uniqueUserId: socket.handshake.query.uniqueUserId}))
            next(new Error('rate limit block'))
        } else if (socket.handshake.auth.token != ioToken) {
            logger.error('auth token error', log.metadata(socket.handshake, {
                token: ioToken,
                tokenReceived: socket.handshake.auth.token,
                uniqueUserId: socket.handshake.query.uniqueUserId
            }))
            next(new Error('invalid token'))
        } else {
            logger.info('connected', log.metadata(socket.handshake, {
                origin: socket.handshake.headers.origin,
                uniqueUserId: socket.handshake.query.uniqueUserId
            }))
            next()
        }
    })

    listener.listen(+process.env.WEBSOCKET_PORT || 8443, () => {
        logger.info('Listening...' + process.env.WEBSOCKET_PORT, log.metadata())
    })
}

module.exports = {
    createServer,
    start
}
