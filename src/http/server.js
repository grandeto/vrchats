const { createServer } = require('https')

function start(server, handler, httpOpts, httpUtils, webSocketHandler) {
    const utils = httpUtils.utils
    const logger = httpUtils.logger
    const log = httpUtils.log
    const isIP = httpUtils.isIP
    const inRange = httpUtils.inRange
    const parser = httpUtils.parser

    const httpsServer = server(httpOpts, handler)

    // http handler config
    handler.set('x-powered-by', false)
    if (process.env.USE_PROXY == 1) {
        handler.set('trust proxy', process.env.TRUST_PROXY || true)
    }

    handler.use(parser)

    // Publishers API

    // middleware
    handler.use((req, res, next) => {
        let allowedIps = process.env.ALLOWED_IPS.split(','),
            trustProxy = process.env.TRUST_PROXY.split(','),
            ip = utils.fetchV4Ip(req.socket.remoteAddress)

        if (process.env.USE_PROXY == 1) {
            let proxyIp = ip
            ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']

            if (!isIP(proxyIp) || !isIP(ip)) {
                logger.error('invalid proxy_ip or ip', log.metadata(req))
                res.status(403).send('Forbidden')
            } else if (!inRange(proxyIp, trustProxy) || !inRange(ip, allowedIps)) {
                // in case the service is behind cloudflare, add cloudflare's ip ranges in .env TRUST_PROXY
                logger.error('untrusted proxy_ip or ip', log.metadata(req))
                res.status(403).send('Forbidden')
            } else {
                next()
            }
        } else {
            if (!isIP(ip) || !inRange(ip, allowedIps)) {
                logger.error('invalid or untrusted ip', log.metadata(req))
                res.status(403).send('Forbidden')
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
        if (new RegExp('^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$').test(req.body.uuid)) {
            let to = req.body.uuid
            delete req.body.uuid
            webSocketHandler.emit(to, req.body)

            res.status(200).send('OK')
        } else {
            logger.error('Invalid to.uuid', log.metadata(req, {
                toUiid: req.body.to.uuid,
                fromId: req.body.from.id
            }))

            res.status(400).send('BAD REQUEST')
        }
    })

    // errors
    handler.use((err, req, res, next) => {
        logger.error('req/res error', log.metadata(req, {stack: err.stack}))
        res.status(500).send('ISE')
    })

    // listen

    httpsServer.listen(+process.env.HTTP_PORT || 2053, () => {
        logger.info('Listening...' + process.env.HTTP_PORT, log.metadata())
    })
}

module.exports = {
    createServer,
    start
}
