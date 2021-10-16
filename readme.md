# Description

Event-driven real-time chat processor based on Socket.io

# Requirements

- Node.js v14.17.6

# Features

- HTTPS events listener (Cluster mode supported)
- Whitelisting of origins, ip ranges, proxy ranges
- Clients connection Auth and Rate Limiter

# Start the app

```bash
npm install
```

## Standalone mode with HTTPS support (Single threaded)


Create `.env` file and populate the env variables found in `.env_example` into it

```bash
npm install -g pm2 && \
pm2 start /var/www/vrchats/standalone.config.js
```

## Cluster mode with HTTPS support (Multi threaded)


### Note: This is actually a partial cluster single node implementation


It depends on [@grandeto/pm2-socket.io](https://github.com/grandeto/pm2) that can be used as a drop-in replacement for `pm2`, and supports all the commands of the class `pm2` utility.

The only difference comes from this [commit]()

The `pm2` God process now creates its own HTTPS express socket.io server instance that handles the socket.io consumers' connections and push the events from socket.io producers to them

At the same time `pm2` will bootstrap as many `@grandeto/vrchats producers` as threads-1 available on the node

The so called producers are HTTPS express instances that expose simple HTTPS API and listen for incoming events and propagate them to the initiated by `pm2` God process socket.io server. The producers are socket.io agnostic and could be used from any backend by just sending a POST request containing the event

The initiated by `pm2` God process socket.io server is not spread to all of the node threads thus this cluster mode is actually partial cluster

For multi-node clustering an in-front proxy load balancer that ensures sticky connections to the nodes behind is needed

If `pm2` is already installed, you will have to remove it first:

```bash
npm remove -g pm2
```

then install `@grandeto/pm2-socket.io`

```bash
npm install -g @grandeto/pm2-socket.io
```

Start the app by

```bash
NODE_ENV="production" CLUSTER_MODE=1 PORT=2053 PM2_PORT=8443 ALLOWED_ORIGINS="https://example.com" ALLOWED_IPS="123.123.123.123/32,127.0.0.1/32,::1/128" TRUST_PROXY="103.21.244.0/22,103.22.200.0/22,103.31.4.0/22,104.16.0.0/13,104.24.0.0/14,108.162.192.0/18,131.0.72.0/22,141.101.64.0/18,162.158.0.0/15,172.64.0.0/13,173.245.48.0/20,188.114.96.0/20,190.93.240.0/20,197.234.240.0/22,198.41.128.0/17,2400:cb00::/32,2606:4700::/32,2803:f800::/32,2405:b500::/32,2405:8100::/32,2c0f:f248::/32,2a06:98c0::/29" PUB_KEY_PATH="/var/www/vrchats/pubkey.pem" PRIV_KEY_PATH="/var/www/vrchats/privkey.pem" CA_PATH="/var/www/vrchats/ca.pem" VERIFY_ORIGIN=1 IO_TOKEN_RENEW_START_HOUR=0 IO_TOKEN_RENEW_INTERVAL=86400000 USE_PROXY=1 LOGS_DIR="/var/www/vrchats/logs" AUTH_TOKEN_SECRET="some-nasty-secret" pm2 start /var/www/vrchats/cluster.config.js
```

# Start locally in debug mode

Create `.env` file and populate the env variables found in `.env_example` into it

```bash
DEBUG=* CLUSTER_MODE=0 node --nouse-idle-notification --expose-gc --max-old-space-size=8192 --trace-sync-io app.js
```

# Tune OS (Linux)

```bash
sudo nano /etc/security/limits.d/custom.conf

root soft nofile 1000000
root hard nofile 1000000
* soft nofile 1000000
* hard nofile 1000000
```

```bash
sudo nano /etc/sysctl.conf

fs.file-max = 1000000
fs.nr_open = 1000000
net.ipv4.netfilter.ip_conntrack_max = 1048576
net.nf_conntrack_max = 1048576
```

```bash
sudo nano /etc/sysctl.d/net.ipv4.ip_local_port_range.conf

net.ipv4.ip_local_port_range = 10000 65535
```
