module.exports = {
    apps: [{
        name: "vrchatsc",
        script: "./app.js",
        instances: process.env.CLUSTER_INSTANCES,
        exec_mode: "cluster",
        exp_backoff_restart_delay: 500,
        node_args: "--nouse-idle-notification --expose-gc --max-old-space-size=8192",
    }]
}
