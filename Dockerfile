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

# Tune OS
ARG LIMITS_CONF=/etc/security/limits.d/custom.conf
RUN if [ ! -f $LIMITS_CONF ]; then \
        touch $LIMITS_CONF; \
    fi; \
    \
    echo "root soft nofile 1000000" >> $LIMITS_CONF \
    && echo "root hard nofile 1000000" >> $LIMITS_CONF \
    && echo "* soft nofile 1000000" >> $LIMITS_CONF \
    && echo "* hard nofile 1000000" >> $LIMITS_CONF

ARG SYSCTL_CONF=/etc/sysctl.conf
RUN echo "fs.file-max = 1000000" >> $SYSCTL_CONF \
    && echo "fs.nr_open = 1000000" >> $SYSCTL_CONF \
    && echo "net.ipv4.netfilter.ip_conntrack_max = 1048576" >> $SYSCTL_CONF \
    && echo "net.nf_conntrack_max = 1048576" >> $SYSCTL_CONF

ARG IP_LOCAL_PORT_RANGE_CONF=/etc/sysctl.d/net.ipv4.ip_local_port_range.conf
RUN if [ ! -f $IP_LOCAL_PORT_RANGE_CONF ]; then \
        touch $IP_LOCAL_PORT_RANGE_CONF; \
    fi; \
    \
    echo "net.ipv4.ip_local_port_range = 10000 65535" >> $IP_LOCAL_PORT_RANGE_CONF

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

ARG NEW_VERSION_FILE="node-v$NODE_VERSION-linux-x64.tar.gz"
ARG NEW_VERSION_DIR="node-v$NODE_VERSION-linux-x64"
ARG HOME_DIR_NODE=.nodejs
ARG NODE_INSTALL_DIR=/usr/local/lib/nodejs

RUN if [ ! -d $HOME_DIR_NODE ]; then \
        mkdir -p $HOME_DIR_NODE; \
    fi; \
    \
    if [ ! -d $NODE_INSTALL_DIR ]; then \
        mkdir -p $NODE_INSTALL_DIR; \
    fi;

RUN wget "https://nodejs.org/dist/v$NODE_VERSION/$NEW_VERSION_FILE"

RUN if [ ! -f $NEW_VERSION_FILE ]; then \
        echo "ERROR: $NEW_VERSION_FILE not found"; \
        exit 1; \
    fi;

RUN rm -rf $NODE_INSTALL_DIR/* \
    && rm -rf $HOME_DIR_NODE/* \
    && rm -rf $HOME/.npm

RUN tar -xvf $NEW_VERSION_FILE --directory $NODE_INSTALL_DIR \
    && cp -R $NODE_INSTALL_DIR/$NEW_VERSION_DIR/* $NODE_INSTALL_DIR \
    && rm -rf $NODE_INSTALL_DIR/$NEW_VERSION_DIR

RUN npm config set prefix $HOME_DIR_NODE \
    && npm install -g npm@$NPM_VERSION \
    && rm $NODE_INSTALL_DIR/bin/np*

# Install pm2
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

ENV PRODUCER_PORT=2053
ENV CONSUMER_PORT=8443
ENV STANDALONE_PORT=8443

EXPOSE 2053
EXPOSE 8443

ENTRYPOINT ["docker-entrypoint.sh"]

CMD ["/bin/bash", "-c", "pm2-runtime $APP_DIR/$APP_MODE.config.js"]