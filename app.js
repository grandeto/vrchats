require('dotenv').config()

const clusterMode = +process.env.CLUSTER_MODE

switch (clusterMode) {
    case 1:
        const resolveGlobal = require('resolve-global');
        try {
            resolveGlobal('@grandeto/pm2-socket.io')
        } catch(e) {
            console.error('@grandeto/pm2-socket.io not installed globally. Run: npm i -g @grandeto/pm2-socket.io', e)
            process.exit()
        }
        const vrchatsCluster = require('./src/cluster.js')
        vrchatsCluster.socketProducerInit()
        break;
    case 0:
        const vrchatsStandalone = require('./src/standalone.js')
        vrchatsStandalone.standaloneInit()
        break;
    default:
        console.error('env var CLUSTER_MODE is undefined. Exiting...')
        process.exit()
}
