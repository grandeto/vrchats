#!/usr/bin/env bash

NODEV=$1
NPMV=$2
NPMDEFAULTV="latest"

HELP="Use: bumpnode 14.18.1 8.1.1 \n where 14.18.1 is node.js version \n and 8.1.1 is npm version"

if [ -v $NPMV ]; then
    NPMV=$NPMDEFAULTV
fi

if [[ $NODEV == "h" || $NODEV == "-h" || $NODEV == "help" ]]; then
    echo -e $HELP
    exit 0
fi

if [[ ! $NODEV =~ ^[0-9]+\.[0-9]+\.[0-9] ]]; then
    echo -e $HELP
    exit 1
fi

if [[ ! $NPMV =~ ^[0-9]+\.[0-9]+\.[0-9] && $NPMV != $NPMDEFAULTV ]]; then
    echo -e $HELP
    exit 1
fi

cd
source ~/.profile

NEW_NODE_ARCHIVE="node-v$NODEV-linux-x64.tar.gz"
NEW_NODE_EXTRACTED_DIR="node-v$NODEV-linux-x64"
NPM_INSTALL_DIR=$HOME/.nodejs
NODE_INSTALL_DIR=/usr/local/lib/nodejs

if [ ! -d $NPM_INSTALL_DIR ]; then
    mkdir -p $NPM_INSTALL_DIR
fi

if [ ! -d $NODE_INSTALL_DIR ]; then
    sudo mkdir -p $NODE_INSTALL_DIR
fi

if [ ! -f $NEW_NODE_ARCHIVE ]; then
    URL="https://nodejs.org/dist/v$NODEV/$NEW_NODE_ARCHIVE"

    echo "downloading $NEW_NODE_ARCHIVE"

    wget $URL
fi


if [ -f $NEW_NODE_ARCHIVE ]; then
    echo "cleaning old node/npm installations"
    sudo rm -rf $NODE_INSTALL_DIR/*
    sudo rm -rf $NPM_INSTALL_DIR/*
    sudo rm -rf $HOME/.npm
    sudo rm $HOME/.npmrc

    echo "installing nodejs $NODEV"
    sudo tar -xvf $NEW_NODE_ARCHIVE --directory $NODE_INSTALL_DIR
    sudo cp -R $NODE_INSTALL_DIR/$NEW_NODE_EXTRACTED_DIR/* $NODE_INSTALL_DIR

    sudo rm -rf $NODE_INSTALL_DIR/$NEW_NODE_EXTRACTED_DIR
    sudo find $NODE_INSTALL_DIR -type d -exec chmod 755 {} \;
    sudo find $NODE_INSTALL_DIR -type f -exec chmod 644 {} \;
    sudo chmod 755 $NODE_INSTALL_DIR/bin/node
    sudo chmod 755 $NODE_INSTALL_DIR/bin/npm

    echo "setting npm dir to $NPM_INSTALL_DIR"
    npm config set prefix $NPM_INSTALL_DIR

    echo "installing npm $NPMV"
    npm install -g npm@$NPMV

    sudo rm $NODE_INSTALL_DIR/bin/np*

    source ~/.profile

    echo "installed node -v"
    node -v
    echo "installed npm -v"
    npm -v

    exit 0
else
    echo "ERROR: $NEW_NODE_ARCHIVE not found"
    exit 1
fi
