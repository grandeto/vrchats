const { createServer } = require('https')

function start(handler, listener, webSocketUtils) {
    const utils = webSocketUtils.utils
    const logger = webSocketUtils.logger
    const log = webSocketUtils.log
    const rateLimiter = webSocketUtils.rateLimiter
    const port = utils.webSocketServerPort()
    const webSocketAuthEnabled = utils.webSocketAuthEnabled()
    const ioTokenRenewInterval = utils.webSocketAuthTokenRenewInterval()
    const tokenSecret = utils.webSocketAuthTokenSecret()

    // Subscribers API

    // websocket auth token renewal - TODO move out from the server
    let ioToken = ""
    if (webSocketAuthEnabled) {
        ioToken = utils.authTokenHash(tokenSecret)

        let ioTokenRenewStartHour = utils.webSocketAuthTokenRenewStartHour()
        let time = new Date()

        ioTokenRenewStartHour = isNaN(ioTokenRenewStartHour) || (ioTokenRenewStartHour < 0 || ioTokenRenewStartHour > 23) ? time.getUTCHours() : ioTokenRenewStartHour
        ioTokenRenewStartHour = ioTokenRenewStartHour === 0 ? 24 : ioTokenRenewStartHour
        ioTokenRenewStartHour = ioTokenRenewStartHour <= time.getUTCHours() ? (time.getUTCHours()+1) : ioTokenRenewStartHour
        time.setUTCHours(ioTokenRenewStartHour, 0, 0, 0)
        let timeToNextIoTokenRenewInterval = time.getTime() - new Date().getTime()

        setTimeout(function() {
            ioToken = utils.authTokenHash(tokenSecret)
            setInterval(function() {
                ioToken = utils.authTokenHash(tokenSecret)
            }, ioTokenRenewInterval)
        }, timeToNextIoTokenRenewInterval)
    }

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
        } else if (webSocketAuthEnabled && socket.handshake.auth.token != ioToken) {
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

    handler.on("connection", async (socket) => {
        const userId = socket.handshake.query.uniqueUserId

        socket.join(userId);
    });

    listener.listen(port, () => {
        logger.info('Listening...' + port, log.metadata())
    })
}

module.exports = {
    createServer,
    start
}
