# Description

Event-driven real-time chat processor based on Socket.io

# Requirements

- Node.js v14.x
- npm 8.x


# Features

- Events listener HTTPS (Cluster mode supported)
- Whitelisting origins, ip ranges, proxy ranges
- Subscribers connection Auth, Rate Limiter

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

## Env create (Docker)

- Install docker

- Clone repo

```bash
sudo mkdir -p /var/www/vrchats
sudo chown $USER.$USER /var/www/vrchats/
cd /var/www/vrchats
git clone https://github.com/grandeto/vrchats.git .
touch .env
```

- Populate `.env` file according to the `.env_example`

```bash
chmod 600 .env
```

- Add `pubkey.pem`, `privkey.pem`, `ca.pem`

```bash
chmod 600 *.pem
```

- Whitelist the defined in `.env` ports in your firewall

- Build an image

```bash
docker build --build-arg NODE_VERSION=14.18.1 --build-arg NPM_VERSION=8.1.1 -t "vrchats" .
```

- Run the image in container (set --cpus, --memory and ports depending on your configuration)

prod:

```bash
docker run -d --name vrchats --restart always --cpus="3" --memory=15500mb -p 8443:8443 -p 2053:2053 vrchats
```

local:

```bash
docker run --name vrchats --cpus="1" --memory=1gb -p 8443:8443 -p 2053:2053 vrchats
```

- Attach to the container, check `ulimits` and tune whatever needed

```bash
docker exec -it vrchats /bin/bash

ulimit -Sa && echo -e "\n" && ulimit -Ha
```

## Env create (Linux)

- Clone repo

```bash
sudo mkdir -p /var/www/vrchats
sudo chown $USER.$USER /var/www/vrchats/
cd /var/www/vrchats
echo 'export APP_DIR=/var/www/vrchats ' >> $HOME/.profile
source ~/.profile
git clone https://github.com/grandeto/vrchats.git .
npm install
touch .env
```

- Populate `.env` file following the env variables in `.env_example`

```bash
chmod 600 .env
```

- Add `pubkey.pem`, `privkey.pem`, `ca.pem`

```bash
chmod 600 *.pem
```

- Whitelist defined ports in .env in your firewall

- Install nodejs & npm

```bash
cd
echo 'export PATH=$PATH:/usr/local/lib/nodejs/bin' >> $HOME/.profile
echo 'export PATH=$PATH:$HOME/.nodejs/bin' >> $HOME/.profile
source ~/.profile

# /usr/local install

cd /var/www/vrchats

./scripts/./bumpnode 14.18.1 8.19.3

reboot
```

### Standalone mode with HTTPS support (Single threaded)

```bash
npm install -g pm2 && \
pm2 start /var/www/vrchats/standalone.config.js
```

### Cluster mode with HTTPS support (Multi threaded)


#### Note: This is actually a partial cluster single node implementation


It depends on [@grandeto/pm2-socket.io](https://github.com/grandeto/pm2) that can be used as a drop-in replacement for `pm2`, and supports all the commands of the class `pm2` utility

The only difference comes from [grandeto commits](https://github.com/grandeto/pm2/commits/5.1.2-grandeto-socket.io?author=grandeto)

The `pm2` God process now creates its own HTTPS express socket.io server instance that handles the socket.io consumers' connections and push the events from the socket.io event producers to them

At the same time `pm2` will bootstrap as many `@grandeto/vrchats producers` as defined in `CLUSTER_INSTANCES` env variable

The so called producers are express instances that expose a simple HTTPS API and listen for incoming events and emit them to the initiated by `pm2` God process socket.io server. 
The producers are socket.io agnostic and could be used from any backend by just sending a POST request containing the event

The initiated by `pm2` God process socket.io server is not spread to all of the threads thus this cluster mode actually act as partially clusterized

- If `pm2` is already installed, you will have to remove it first:

```bash
npm remove -g pm2
```

- then install `@grandeto/pm2-socket.io`

```bash
npm install -g @grandeto/pm2-socket.io
```

- Start the app by (set the variable in the example according you needs)

```bash
NODE_ENV="production" CLUSTER_MODE=1 CLUSTER_INSTANCES="-1" PRODUCER_PORT=2053 CONSUMER_PORT=8443 ALLOWED_ORIGINS="https://example.com" ALLOWED_IPS="123.123.123.123/32,127.0.0.1/32,::1/128" USE_PROXY=1 TRUST_PROXY="103.21.244.0/22,103.22.200.0/22,103.31.4.0/22,104.16.0.0/13,104.24.0.0/14,108.162.192.0/18,131.0.72.0/22,141.101.64.0/18,162.158.0.0/15,172.64.0.0/13,173.245.48.0/20,188.114.96.0/20,190.93.240.0/20,197.234.240.0/22,198.41.128.0/17,2400:cb00::/32,2606:4700::/32,2803:f800::/32,2405:b500::/32,2405:8100::/32,2c0f:f248::/32,2a06:98c0::/29" PUB_KEY_PATH="$APP_DIR/certs/pubkey.pem" PRIV_KEY_PATH="$APP_DIR/certs/privkey.pem" CA_PATH="$APP_DIR/certs/ca.pem" VERIFY_ORIGIN=1 IO_TOKEN_RENEW_START_HOUR=0 IO_TOKEN_RENEW_INTERVAL=86400000 LOGS_DIR="$APP_DIR/logs" AUTH_TOKEN_SECRET="some-nasty-secret" pm2 start $APP_DIR/cluster.config.js
```

- Test the app

```
https://example.com:2053 - should return 200 OK

https://example.com:8443 - should return 404 "Cannot GET /"
```

- Save the pm2 app settings

```bash
pm2 save
```

- Create pm2 startup deamon

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
Environment=ALLOWED_ORIGINS="https://example.com"
Environment=ALLOWED_IPS="123.123.123.123/32,127.0.0.1/32,::1/128"
Environment=USE_PROXY=1
Environment=TRUST_PROXY="103.21.244.0/22,103.22.200.0/22,103.31.4.0/22,104.16.0.0/13,104.24.0.0/14,108.162.192.0/18,131.0.72.0/22,141.101.64.0/18,162.158.0.0/15,172.64.0.0/13,173.245.48.0/20,188.114.96.0/20,190.93.240.0/20,197.234.240.0/22,198.41.128.0/17,2400:cb00::/32,2606:4700::/32,2803:f800::/32,2405:b500::/32,2405:8100::/32,2c0f:f248::/32,2a06:98c0::/29"
Environment=PUB_KEY_PATH=/var/www/vrchats/pubkey.pem
Environment=PRIV_KEY_PATH=/var/www/vrchats/privkey.pem
Environment=CA_PATH=/var/www/vrchats/ca.pem
Environment=VERIFY_ORIGIN=1
Environment=IO_TOKEN_RENEW_START_HOUR=0
Environment=IO_TOKEN_RENEW_INTERVAL=86400000
Environment=LOGS_DIR=/var/www/vrchats/logs
Environment=AUTH_TOKEN_SECRET="some-nasty-secret"
```

- Execute `sudo systemctl daemon-reload`

- reboot

- after reboot test the service is operational

```
pm2 ls - should display list of running instances having status online

https://example.com:2053 - should return 200 OK

https://example.com:8443 - should return 404 "Cannot GET /"
```

### Applying changes

- `pm2 ls && pm2 stop all && pm2 delete all`

- `pm2 save`

- `sudo systemctl restart pm2-$USER`

- `pm2 ls` - verify pm2 started successfuly the app instances with new pids

### Start locally in debug mode

Create `.env` file and populate the env variables found in `.env_example` into it

```bash
cd $APP_DIR
DEBUG=* CLUSTER_MODE=0 node --nouse-idle-notification --expose-gc --max-old-space-size=8192 --trace-sync-io app.js
```

# Troubleshooting and known issues

- It seems `pm2 v5.1.2` has a nasty timezone behaviour, as seen from `.pm2/pm2.log`:

    An example from sequent restarts of pm2-$USER service:
    
    - `2021-12-19T14:53:56: PM2 log: --- New PM2 Daemon started` - has the correct TZ in UTC
    - `2021-12-19T18:24:12: PM2 log: --- New PM2 Daemon started` - the next one executed right after the previous one has started all of the nodes, but outputs an incorrect UTC TZ

    Thus, auto-refreshing of the `auth_token` becomes unreliable and the simplest workaround is a root cron job scheduled to restart the `pm2-$USER` service daily. For instance:

    `0 0 * * * systemctl restart pm2-$USER`

- [pm2 docs - journalctl -u pm2-$USER.service](https://pm2.keymetrics.io/docs/usage/startup/)

- [stackoverflow 43786412](https://stackoverflow.com/questions/43786412/get-message-spawning-pm2-daemon-with-pm2-home-home-dir-pm2-always/69510630#69510630)

- If your home directory is encrypted in order to demonize with `pm2 startup` all the node.js, npm and app raleted files should be outside of the home dir or try [link1](https://bbs.archlinux.org/viewtopic.php?id=201781) [link2](https://superuser.com/questions/1037466/how-to-start-a-systemd-service-after-user-login-and-stop-it-before-user-logout) [link3](https://bbs.archlinux.org/viewtopic.php?id=244264)

# Release

- create branch vX.X.X
- `npm run build:client:min`
- open & merge PR `master <- vX.X.X`
- wait for github actions
- draft new release -> create tag -> publish
- npm login
- npm publish --access public
