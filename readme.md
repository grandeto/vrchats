# Description

Event-driven real-time chat processor based on Socket.io

# Requirements

- Node.js v14.17.6
```
cd

wget https://nodejs.org/dist/v14.17.6/node-v14.17.6-linux-x64.tar.xz

nano .profile

VERSION=v14.17.6
DISTRO=linux-x64
export PATH=/usr/local/lib/nodejs/node-$VERSION-$DISTRO/bin:$PATH

. ~/.profile

mkdir -p /usr/local/lib/nodejs
tar -xJvf node-$VERSION-$DISTRO.tar.xz -C /usr/local/lib/nodejs
```
