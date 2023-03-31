FROM ubuntu:22.04 as builder

LABEL version="0.0.1"
LABEL description="vrchats image - Real-time chat based on Socket.io"

WORKDIR /root

SHELL ["/bin/bash", "-c"]

# Disable Prompt During Packages Installation
ARG DEBIAN_FRONTEND=noninteractive

# Create non-root user
ARG VRCHATS_USER
ARG VRCHATS_USER_HOME=/home/$VRCHATS_USER

RUN echo "CREATE_HOME yes" >> /etc/login.defs
RUN useradd -s /sbin/nologin -c "Docker image user" $VRCHATS_USER

# OS update and config
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get autoremove -y \
    && apt-get install -y apt-utils

RUN apt-get install -y curl wget gnupg ca-certificates apt-transport-https locales && rm -rf /var/lib/apt/lists/* \
	&& localedef -i en_US -c -f UTF-8 -A /usr/share/locale/locale.alias en_US.UTF-8

# Boost local development with reflex
ARG REFLEX_VERSION=v0.3.1
RUN curl -Lo /tmp/reflex_linux_amd64.tar.gz https://github.com/cespare/reflex/releases/download/$REFLEX_VERSION/reflex_linux_amd64.tar.gz \
    && tar -xvf /tmp/reflex_linux_amd64.tar.gz --directory /tmp/ \
    && mv /tmp/reflex_linux_amd64/reflex /usr/local/bin/reflex \
    && chmod +x /usr/local/bin/reflex

ENV LANG=en_US.UTF-8 LANGUAGE=en_US:en LC_ALL=en_US.UTF-8

# Install Nodejs
ARG NODE_VERSION
ARG NPM_VERSION

ENV PATH=$PATH:/usr/local/lib/nodejs/bin:$VRCHATS_USER_HOME/.nodejs/bin

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
ARG NPM_INSTALL_DIR=$VRCHATS_USER_HOME/.nodejs

RUN if [ ! -d $NODE_INSTALL_DIR ]; then \
        mkdir -p $NODE_INSTALL_DIR; \
    fi; \
    \
    if [ ! -d $NPM_INSTALL_DIR ]; then \
        mkdir -p $NPM_INSTALL_DIR; \
    fi;

RUN rm -rf /var/lib/apt/lists/* \
    && for key in \
      4ED778F539E3634C779C87C6D7062848A1AB005C \
      141F07595B7B3FFE74309A937405533BE57C7D57 \
      74F12602B6F1C4E913FAA37AD3A89613643B6201 \
      61FC681DFB92A079F1685E77973F295594EC4689 \
      8FCCA13FEF1D0C2E91008E09770F7A9A5AE15600 \
      C4F0DFFF4E8C1A8236409D08E73BC641CC11F4C8 \
      890C08DB8579162FEE0DF9DB8BEAB4DFCF555EF4 \
      C82FA3AE1CBEDC6BE46B9360C43CEC45C17AB93C \
      108F52B48DB57BB0CC439B2997B01419BD92F80A \
    ; do \
      gpg --batch --keyserver hkps://keys.openpgp.org --recv-keys "$key" || \
      gpg --batch --keyserver keyserver.ubuntu.com --recv-keys "$key" ; \
    done

RUN wget "https://nodejs.org/dist/v$NODE_VERSION/$NEW_NODE_ARCHIVE"
RUN wget "http://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt.asc"

RUN gpg --batch --decrypt --output SHASUMS256.txt SHASUMS256.txt.asc \
    && grep " $NEW_NODE_ARCHIVE\$" SHASUMS256.txt | sha256sum -c - \
    && rm SHASUMS256.txt.asc SHASUMS256.txt

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

RUN chmod 755 $NODE_INSTALL_DIR/bin/node
RUN chmod 755 $NODE_INSTALL_DIR/bin/npm

RUN npm config set prefix $NPM_INSTALL_DIR

RUN npm install -g npm@$NPM_VERSION

RUN rm $NODE_INSTALL_DIR/bin/np*

# Install pm2
RUN npm install -g pm2

# Install app
ENV APP_DIR=/var/www/vrchats

RUN if [ ! -d $APP_DIR ]; then \
        mkdir -p $APP_DIR; \
    fi;

COPY certs $APP_DIR/certs/
COPY src $APP_DIR/src/
COPY app.config.js $APP_DIR/
COPY app.js $APP_DIR/
COPY package.json $APP_DIR/
COPY package-lock.json $APP_DIR/
COPY .env $APP_DIR/
COPY docker-entrypoint.sh /usr/local/bin/

RUN find $APP_DIR -type d -exec chmod 755 {} \;
RUN find $APP_DIR -type f -exec chmod 644 {} \;

RUN chmod 600 $APP_DIR/.env
RUN chmod 600 $APP_DIR/certs/*.pem

RUN chown -R $VRCHATS_USER:$VRCHATS_USER $VRCHATS_USER_HOME
RUN chown -R $VRCHATS_USER:$VRCHATS_USER $APP_DIR

USER $VRCHATS_USER

WORKDIR $APP_DIR

RUN npm install

EXPOSE 2053
EXPOSE 8443

ENTRYPOINT ["docker-entrypoint.sh"]

CMD ["/bin/bash", "-c", "pm2-runtime $APP_DIR/app.config.js"]
