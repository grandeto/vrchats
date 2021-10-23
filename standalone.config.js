module.exports = {
    apps: [{
        name: "vrchatss",
        script: "./app.js",
        exp_backoff_restart_delay: 500,
        node_args: "--nouse-idle-notification --expose-gc --max-old-space-size=8192"
    }]
}
