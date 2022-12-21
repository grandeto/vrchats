const SHA512 = require('crypto-js/sha512')
const path = require('path');

function fetchV4Ip(ip) {
    return ip.substr(0, 7) == '::ffff:' ? ip.substr(7) : ip
}

function allowedOrigins() {
    return process.env.ALLOWED_ORIGINS.split(',')
}

function ioTokenHash() {
    let date = new Date()
    date = date.getUTCFullYear() + '-' + (date.getUTCMonth()+1)  + '-' + date.getUTCDate()

    return SHA512(process.env.AUTH_TOKEN_SECRET + date).toString()
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

function appDir() {
    let dir = __dirname.split(path.sep)
    dir.pop()

    return dir.join(path.sep)
}

module.exports = {
    ioTokenHash,
    allowedOrigins,
    fetchV4Ip,
    appDir,
    caPath,
    pubKeyPath,
    privKeyPath
}
