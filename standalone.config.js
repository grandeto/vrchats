module.exports = {
    apps: [{
        name: "vrchatss",
        script: "./app.js",
        node_args: "--nouse-idle-notification --expose-gc --max-old-space-size=8192"
    }]
}
