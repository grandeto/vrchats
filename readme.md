# Description

HTTP/WebSocket real-time message processor based on Socket.io

# Requirements

- Node.js v18.15.0
- npm 9.5.0


# Features

- HTTP event handler
- WebSocket multicast emitter
- Publishers: Trusted Origins, CIDRs, PROXY
- Subscribers: WebSocket Auth, Rate Limiter

# Environment

## Tune OS (Linux)

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

- Logout

- Check your `ulimits` and tune whatever else needed

```bash
ulimit -Sa && echo -e "\n" && ulimit -Ha
```

## Tune Node.js for websocket connections

- https://blog.jayway.com/2015/04/13/600k-concurrent-websocket-connections-on-aws-using-node-js/

## Env create (Docker)

- Install docker

- Clone the source

```bash
git clone https://github.com/grandeto/vrchats.git .
```

- Create an `.env` file following the `.env_example`

```bash
chmod 600 .env
```

- Add `pubkey.pem`, `privkey.pem`, `ca.pem` into `./certs`

```bash
chmod 600 ./certs/*.pem
```

- Whitelist `.env` defined ports in your firewall

### Prod

- Build an image

```bash
docker build --build-arg VRCHATS_USER=$USER --build-arg NODE_VERSION=18.15.0 --build-arg NPM_VERSION=9.5.0 -t "vrchats" .
```

- Run the image in container (set or remove --cpus, --memory and ports depending on your configuration)

```bash
docker run -d --name vrchats --restart always -p 8443:8443 -p 2053:2053 vrchats
```

- Attach to the container, check `ulimits` and tune whatever needed

```bash
docker exec -it vrchats /bin/bash

ulimit -Sa && echo -e "\n" && ulimit -Ha
```

- applying changes 
    - re-run build step followed by:

    ```bash

    docker stop vrchats && docker rm vrchats && docker run -d --name vrchats --restart always -p 8443:8443 -p 2053:2053 vrchats
    ```

- *NOTE: Consider adding a cronjob in order to handle https://github.com/grandeto/vrchats#pm2-knows-issues

    `0 0 * * * docker restart vrchats`

### Dev

```bash
npm run dev.run

npm run dev.remove

npm run dev.update
```

## Env create (pm2)

- Save pm2 settings

```bash
pm2 save
```

- pm2 deamon

```bash
pm2 startup
```

- Copy and execute the output command generated by `pm2 startup` then:

`sudo nano /etc/systemd/system/pm2-$USER.service` and:

add `Wants=network-online.target` above `After=network.target`

add `RequiresMountsFor=/home` above `After=network.target`

change `After=network.target` to `After=network.target network-online.target`

change `WantedBy=multi-user.target` to `WantedBy=multi-user.target network-online.target`

add under `[Service]` the following env variables:

```
Environment=NODE_ENV=production
Environment=CLUSTER_MODE=1
Environment=CLUSTER_INSTANCES="-1"
Environment=PRODUCER_PORT=2053
Environment=CONSUMER_PORT=8443
Environment=STANDALONE_PORT=8443
Environment=TRUST_ORIGIN_LIST="https://example.com"
Environment=TRUST_CIDR_LIST="123.123.123.123/32,127.0.0.1/32,::1/128"
Environment=USE_PROXY=1
Environment=TRUST_PROXY_LIST="103.21.244.0/22,103.22.200.0/22,103.31.4.0/22,104.16.0.0/13,104.24.0.0/14,108.162.192.0/18,131.0.72.0/22,141.101.64.0/18,162.158.0.0/15,172.64.0.0/13,173.245.48.0/20,188.114.96.0/20,190.93.240.0/20,197.234.240.0/22,198.41.128.0/17,2400:cb00::/32,2606:4700::/32,2803:f800::/32,2405:b500::/32,2405:8100::/32,2c0f:f248::/32,2a06:98c0::/29"
Environment=PUB_KEY_PATH=/var/www/vrchats/pubkey.pem
Environment=PRIV_KEY_PATH=/var/www/vrchats/privkey.pem
Environment=CA_PATH=/var/www/vrchats/ca.pem
Environment=VERIFY_ORIGIN=1
Environment=WEBSOCKET_AUTH_TOKEN_RENEW_START_HOUR=0
Environment=WEBSOCKET_AUTH_TOKEN_RENEW_INTERVAL=86400000
Environment=WEBSOCKET_AUTH_TOKEN_SECRET="some-nasty-secret"
```

- Execute `sudo systemctl daemon-reload`

- reboot

- after reboot test the service is operational

```
pm2 ls - should display list of running instances having status online
```

### pm2 applying changes

- `pm2 ls && pm2 stop all && pm2 delete all`

- `pm2 save`

- `sudo systemctl restart pm2-$USER`

- `pm2 ls` - verify pm2 started successfuly the app instances with new pids

# Test connectivity

```
https://example.com:2053/status - should return 200 OK

https://example.com:8443 - should return 404 "Cannot GET /"
```

# Monitoring

- set `ENABLE_DEBUG=1`

- rebuild and deploy

- attach to container

`pm2 monit` and `pm2 logs`

- TODO export and collect metrics

- TODO collect log stream

# Troubleshooting and known issues

## pm2 knows issues

- It seems `pm2 v5.1.2` has a weird timezone behaviour, as seen from `.pm2/pm2.log`:

    An example from sequent restarts of pm2-$USER service:
    
    - `2021-12-19T14:53:56: PM2 log: --- New PM2 Daemon started` - has the correct TZ in UTC
    - `2021-12-19T18:24:12: PM2 log: --- New PM2 Daemon started` - the next one executed right after the previous one has started all of the nodes, but outputs an incorrect UTC TZ

    Thus, auto-refreshing of the `auth_token` becomes unreliable and the simplest workaround is a root cron job scheduled to restart the `pm2-$USER` service daily. For instance:

    `0 0 * * * systemctl restart pm2-$USER`

- [pm2 docs - journalctl -u pm2-$USER.service](https://pm2.keymetrics.io/docs/usage/startup/)

- [stackoverflow 43786412](https://stackoverflow.com/questions/43786412/get-message-spawning-pm2-daemon-with-pm2-home-home-dir-pm2-always/69510630#69510630)

- If your home directory is encrypted in order to demonize with `pm2 startup` all the node.js, npm and app raleted files should be outside of the home dir or try [link1](https://bbs.archlinux.org/viewtopic.php?id=201781) [link2](https://superuser.com/questions/1037466/how-to-start-a-systemd-service-after-user-login-and-stop-it-before-user-logout) [link3](https://bbs.archlinux.org/viewtopic.php?id=244264)

# Cluster mode

- TODO k8s managed chat cluster with shared, sticky sessions free, instance-subscribers registry

# Client

- check the client_example dir and socket.io docs

# Release

- create branch vX.X.X
- open PR `master <- vX.X.X`
- merge PR
- wait for github actions
- draft new release -> create tag -> publish
- npm login
- npm publish --access public
