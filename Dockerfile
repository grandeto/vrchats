FROM ubuntu:22.04 as builder

LABEL version="0.0.1"
LABEL description="vrchats image - Real-time chat based on Socket.io"

WORKDIR /root

SHELL ["/bin/bash", "-c"]

# Disable Prompt During Packages Installation
ARG DEBIAN_FRONTEND=noninteractive

# OS update and config
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get autoremove -y \
    && apt-get install -y apt-utils 
    
Run apt-get install -y wget ca-certificates apt-transport-https locales && rm -rf /var/lib/apt/lists/* \
	&& localedef -i en_US -c -f UTF-8 -A /usr/share/locale/locale.alias en_US.UTF-8

ENV LANG=en_US.UTF-8 LANGUAGE=en_US:en LC_ALL=en_US.UTF-8

# Install Nodejs
ARG NODE_VERSION
ARG NPM_VERSION

ENV PATH=$PATH:/usr/local/lib/nodejs/bin:/root/.nodejs/bin

RUN if [ -z $NODE_VERSION ] || [[ ! $NODE_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9] ]]; then \
        echo "incorrect --build-arg NODE_VERSION"; \
        exit 1; \
    fi; \
    \
    if [ -z $NPM_VERSION ] || [[ ! $NPM_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9] ]]; then \
        echo "incorrect --build-arg NPM_VERSION"; \
        exit 1; \
    fi;

ARG NEW_NODE_ARCHIVE="node-v$NODE_VERSION-linux-x64.tar.gz"
ARG NEW_NODE_EXTRACTED_DIR="node-v$NODE_VERSION-linux-x64"

ARG NODE_INSTALL_DIR=/usr/local/lib/nodejs
ARG NPM_INSTALL_DIR=.nodejs

RUN if [ ! -d $NODE_INSTALL_DIR ]; then \
        mkdir -p $NODE_INSTALL_DIR; \
    fi; \
    \
    if [ ! -d $NPM_INSTALL_DIR ]; then \
        mkdir -p $NPM_INSTALL_DIR; \
    fi;
    

RUN wget "https://nodejs.org/dist/v$NODE_VERSION/$NEW_NODE_ARCHIVE"

RUN if [ ! -f $NEW_NODE_ARCHIVE ]; then \
        echo "ERROR: $NEW_NODE_ARCHIVE not found"; \
        exit 1; \
    fi;

RUN rm -rf $NODE_INSTALL_DIR/* \
    && rm -rf $NPM_INSTALL_DIR/* \
    && rm -rf $HOME/.npm

RUN tar -xvf $NEW_NODE_ARCHIVE --directory $NODE_INSTALL_DIR \
    && cp -R $NODE_INSTALL_DIR/$NEW_NODE_EXTRACTED_DIR/* $NODE_INSTALL_DIR \
    && rm -rf $NODE_INSTALL_DIR/$NEW_NODE_EXTRACTED_DIR

RUN npm config set prefix $NPM_INSTALL_DIR \
    && npm install -g npm@$NPM_VERSION \
    && rm $NODE_INSTALL_DIR/bin/np*

# Install @grandeto/pm2-socket.io
RUN npm remove -g pm2
RUN npm install -g @grandeto/pm2-socket.io

# Install app
ENV APP_DIR=/var/www/vrchats

RUN if [ ! -d $APP_DIR ]; then \
        mkdir -p $APP_DIR; \
    fi;

ADD certs $APP_DIR/certs/
ADD logs $APP_DIR/logs/
ADD src $APP_DIR/src/
ADD *.js $APP_DIR/
ADD *.json $APP_DIR/
ADD .env $APP_DIR/
ADD docker-entrypoint.sh /usr/local/bin/

RUN chmod 600 $APP_DIR/.env
RUN chmod 600 $APP_DIR/certs/*.pem
RUN cd $APP_DIR && npm install

ENTRYPOINT ["docker-entrypoint.sh"]

CMD ["/bin/bash", "-c", "pm2-runtime $APP_DIR/$APP_MODE.config.js"]