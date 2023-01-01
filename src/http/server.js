const { createServer } = require('https')

function start(server, handler, httpOpts, serverUtils, webSocketHandler) {
    const utils = serverUtils.utils
    const logger = serverUtils.logger
    const log = serverUtils.log
    const isIP = serverUtils.isIP
    const inRange = serverUtils.inRange
    const parser = serverUtils.parser
    const eventIDValidator = serverUtils.eventIDValidator
    const port = utils.httpServerPort()
    const useProxy = utils.useProxy()
    const trustProxyList = utils.trustProxyList()
    const trustCIDRList = utils.trustCIDRList()

    const httpsServer = server(httpOpts, handler)
    const httpForbidden = "FORBIDDEN"
    const httpDebug = utils.debugEnabled()

    // http handler config
    handler.set('x-powered-by', false)
    if (useProxy) {
        handler.set('trust proxy', trustProxyList || true)
    }

    handler.use(parser)

    // Publishers API

    // middleware
    handler.use((req, res, next) => {
        let ip = utils.fetchIPv4(req.socket.remoteAddress)

        if (useProxy) {
            let proxyIp = ip
            ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']

            if (!isIP(proxyIp) || !isIP(ip)) {
                logger.error('invalid proxy_ip or ip', log.metadata(req))
                res.status(403).send(httpForbidden)
            } else if (!inRange(proxyIp, trustProxyList) || !inRange(ip, trustCIDRList)) {
                // in case the service is behind cloudflare, add cloudflare's ip ranges in .env TRUST_PROXY_LIST
                logger.error('untrusted proxy_ip or ip', log.metadata(req))
                res.status(403).send(httpForbidden)
            } else {
                next()
            }
        } else {
            if (!isIP(ip)) {
                logger.error('invalid', log.metadata(req))
                res.status(403).send(httpForbidden)
            } else if (!inRange(ip, trustCIDRList)) {
                logger.error('untrusted ip', log.metadata(req))
                res.status(403).send(httpForbidden)
            } else {
                next()
            }
        }
    })

    // status
    handler.get('/status', (req, res) => {
        res.status(200).send('OK')
    })

    // events
    handler.post('/publish', (req, res) => {
        if (httpDebug) {
            logger.info('-----DEBUG-----')
            logger.info(req.body, log.metadata(req))
        }

        if (!eventIDValidator.test(req.body.target_id)) {
            logger.error('Invalid req.body.id', log.metadata(req))
            res.status(400).send('BAD REQUEST')
        }

        let roomIdTargetId = req.body.target_id
        delete req.body.target_id

        webSocketHandler.to(roomIdTargetId).emit(roomIdTargetId, req.body)

        res.status(200).send('OK')
    })

    // errors
    handler.use((err, req, res, next) => {
        logger.error('req/res error', log.metadata(req, {stack: err.stack}))
        res.status(500).send('INTERNAL SERVER ERROR')
    })

    // listen
    httpsServer.listen(port, () => {
        logger.info('Listening...' + port, log.metadata())
    })
}

module.exports = {
    createServer,
    start
}
