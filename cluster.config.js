module.exports = {
    apps: [{
        name: "vrchatsc",
        script: "./app.js",
        instances: "-1",
        exec_mode: "cluster",
        node_args: "--nouse-idle-notification --expose-gc --max-old-space-size=8192",
    }]
}
