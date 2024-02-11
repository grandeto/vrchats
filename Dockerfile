FROM node:20.11.0-alpine AS builder

LABEL version="0.0.1"
LABEL description="vrchats image - Real-time chat based on Socket.io"

WORKDIR /var/www/vrchats

ARG NOCACHE
ARG VRCHATS_USER=vrchats
ARG STAGE=prod

# Boost local development with reflex
ARG REFLEX_VERSION=v0.3.1
RUN if [ $STAGE == "local" ]; then \
        apk add curl && curl -Lo /tmp/reflex_linux_amd64.tar.gz https://github.com/cespare/reflex/releases/download/$REFLEX_VERSION/reflex_linux_amd64.tar.gz \
        && tar -xvf /tmp/reflex_linux_amd64.tar.gz --directory /tmp/ \
        && mv /tmp/reflex_linux_amd64/reflex /usr/local/bin/reflex \
        && chmod +x /usr/local/bin/reflex; \
    fi;

# Install pm2
RUN npm install -g pm2

COPY certs certs
COPY src src
COPY app.config.js .
COPY app.js .
COPY package.json .
COPY package-lock.json .
COPY .env .
COPY docker-entrypoint.sh /usr/local/bin/

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN find . -type d -exec chmod 755 {} \;
RUN find . -type f -exec chmod 644 {} \;

RUN chmod 600 .env
RUN chmod 600 ./certs/*.pem

RUN npm install

RUN adduser -u 10001 -D -h /home/$VRCHATS_USER -s /sbin/nologin $VRCHATS_USER

RUN chown -R $VRCHATS_USER:$VRCHATS_USER .

USER $VRCHATS_USER

EXPOSE 2053
EXPOSE 8443

ENTRYPOINT ["docker-entrypoint.sh"]
CMD [ "pm2-runtime /var/www/vrchats/app.config.js" ]
