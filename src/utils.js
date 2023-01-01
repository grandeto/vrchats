const SHA512 = require('crypto-js/sha512')
const path = require('path');
const httpServerDefaultPort = 2053
const webSocketDefultPort = 8443
const webSocketAuthTokenDefaultRenewInterval = 86400000
const webSocketAuthTokenDefaultRenewStartHour = 0

function nodeArgs() {
    let node_args = []

    if (process.env.V8_NOUSE_IDLE_NOTIFICATION == 1) {
        node_args.push("--nouse-idle-notification")
    }
    if (process.env.V8_EXPOSE_GC == 1) {
        node_args.push("--expose-gc")
    }
    if (+process.env.V8_MAX_OLD_SPACE_SIZE > 0) {
        node_args.push("--max-old-space-size=" + process.env.V8_MAX_OLD_SPACE_SIZE)
    }
    if (+process.env.V8_MAX_NEW_SPACE_SIZE > 0) {
        node_args.push("--max-new-space-size=" + process.env.V8_MAX_NEW_SPACE_SIZE)
    }
    if (process.env.ENABLE_DEBUG == 1) {
        node_args.push("--trace-sync-io")
    }

    return node_args.join(" ")
}

function appDir() {
    let dir = __dirname.split(path.sep)
    dir.pop()

    return dir.join(path.sep)
}

function caPath() {
    return path.normalize(process.env.CA_PATH)
}

function pubKeyPath() {
    return path.normalize(process.env.PUB_KEY_PATH)
}

function privKeyPath() {
    return path.normalize(process.env.PRIV_KEY_PATH)
}

function httpServerPort() {
    if (+process.env.HTTP_PORT > 0) {
        return +process.env.HTTP_PORT
    }

    return httpServerDefaultPort
}

function webSocketServerPort() {
    if (+process.env.WEBSOCKET_PORT > 0) {
        return +process.env.WEBSOCKET_PORT
    }

    return webSocketDefultPort
}

function useProxy() {
    return process.env.USE_PROXY == 1
}

function trustProxyList() {
    return process.env.TRUST_PROXY_LIST.split(',')
}

function trustCIDRList() {
    return process.env.TRUST_CIDR_LIST.split(',')
}

function allowedOrigins() {
    return process.env.ALLOWED_ORIGINS.split(',')
}

function verifyOrigin() {
    return process.env.VERIFY_ORIGIN == 1
}

function fetchIPv4(ip) {
    return ip.substr(0, 7) == '::ffff:' ? ip.substr(7) : ip
}

function webSocketAuthTokenSecret() {
    return process.env.WEBSOCKET_AUTH_TOKEN_SECRET
}

function webSocketAuthTokenRenewInterval() {
    return +process.env.WEBSOCKET_AUTH_TOKEN_RENEW_INTERVAL > 0 ? +process.env.WEBSOCKET_AUTH_TOKEN_RENEW_INTERVAL : webSocketAuthTokenDefaultRenewInterval
}

function webSocketAuthTokenRenewStartHour() {
    return +process.env.WEBSOCKET_AUTH_TOKEN_RENEW_START_HOUR > 0 ? +process.env.WEBSOCKET_AUTH_TOKEN_RENEW_START_HOUR : webSocketAuthTokenDefaultRenewStartHour
}

function authTokenHash(token) {
    let date = new Date()
    date = date.getUTCFullYear() + '-' + (date.getUTCMonth()+1)  + '-' + date.getUTCDate()

    return SHA512(token + date).toString()
}

function eventIDValidator() {
    return new RegExp(process.env.EVENT_ID_REGEX_VALIDATION_PATTERN)
}

function debugEnabled() {
    return process.env.ENABLE_DEBUG == 1
}

module.exports = {
    nodeArgs,
    appDir,
    caPath,
    pubKeyPath,
    privKeyPath,
    httpServerPort,
    webSocketServerPort,
    useProxy,
    trustProxyList,
    trustCIDRList,
    allowedOrigins,
    verifyOrigin,
    fetchIPv4,
    webSocketAuthTokenSecret,
    webSocketAuthTokenRenewInterval,
    webSocketAuthTokenRenewStartHour,
    authTokenHash,
    eventIDValidator,
    debugEnabled
}
