require('dotenv').config()

const path = require('path');
const utils = require('./src/utils.js')
const app = path.join(path.normalize(utils.appDir()), "./app.js")

module.exports = {
    apps: [{
        name: "vrchats",
        script: app,
        exp_backoff_restart_delay: 500,
        node_args: utils.nodeArgs()
    }]
}
