FROM node:14

WORKDIR /app

COPY . .

# System
RUN apt update
RUN apt install -y nano \
    && apt install -y jq

# Plugins
RUN mkdir -p /app/sollar/runtime \
    && chmod +x /app/scr/start \
    && chmod +x /app/scr/reset \
    && chmod +x /app/run \
    && npm i --quiet --silent \
    && cd /app/plugins/iz3-bitcore-crypto \
    && npm i --quiet --silent \
    && npm install --quiet --silent -g wscat \
    && npm install --quiet --silent -g forever \
    && cd /app

CMD /bin/bash

EXPOSE 3017 6018
