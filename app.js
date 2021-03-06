require('dotenv').config()

if (process.env.CLUSTER_MODE == 1) {
    const resolveGlobal = require('resolve-global');
    try {
        resolveGlobal('@grandeto/pm2-socket.io')
    } catch(e) {
        console.error('@grandeto/pm2-socket.io not installed globally. Run: npm i -g @grandeto/pm2-socket.io', e)
        process.exit()
    }
    const vrchatsCluster = require('./cluster.js')
    vrchatsCluster.socketProducerInit()
} else if (process.env.CLUSTER_MODE == 0) {
    const vrchatsStandalone = require('./standalone.js')
    vrchatsStandalone.standaloneInit()
} else {
    console.error('env var CLUSTER_MODE is undefined. Exiting...')
    process.exit()
}
