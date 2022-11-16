const path = require('path');

const app = path.join(path.normalize(process.env.APP_DIR), "./app.js")

module.exports = {
    apps: [{
        name: "vrchats_standalone",
        script: app,
        exp_backoff_restart_delay: 500,
        node_args: "--nouse-idle-notification --expose-gc --max-old-space-size=8192"
    }]
}
