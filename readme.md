# Description

Event-driven real-time chat processor based on Socket.io

# Requirements

- Node.js v14.17.6

# Initial Setup

- Install Node.js as a regular sudo user

```
cd

wget https://nodejs.org/dist/v14.17.6/node-v14.17.6-linux-x64.tar.xz

nano .profile

VERSION=v14.17.6
DISTRO=linux-x64
export PATH=/usr/local/lib/nodejs/node-$VERSION-$DISTRO/bin:$PATH

. ~/.profile

sudo mkdir -p /usr/local/lib/nodejs
sudo tar -xJvf node-$VERSION-$DISTRO.tar.xz -C /usr/local/lib/nodejs
```

- Tune OS

```
sudo nano /etc/security/limits.d/custom.conf

root soft nofile 1000000
root hard nofile 1000000
* soft nofile 1000000
* hard nofile 1000000
```

```
sudo nano /etc/sysctl.conf

fs.file-max = 1000000
fs.nr_open = 1000000
net.ipv4.netfilter.ip_conntrack_max = 1048576
net.nf_conntrack_max = 1048576
```

```
sudo nano /etc/sysctl.d/net.ipv4.ip_local_port_range.conf

net.ipv4.ip_local_port_range = 10000 65535
```

# Tune Node.js

- Run app by

`node --nouse-idle-notification --expose-gc --max-old-space-size=8192 app.js`

- Debug mode

`DEBUG=* node --nouse-idle-notification --expose-gc --max-old-space-size=8192 --trace-sync-io app.js`


