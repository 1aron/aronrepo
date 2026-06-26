FROM node:24-slim AS base

ADD .github/actions/package.json /action/
RUN cd /action && npm install --omit=dev

ADD .github/actions/src /action/src
ENTRYPOINT ["node", "/action/src/index.js"]
