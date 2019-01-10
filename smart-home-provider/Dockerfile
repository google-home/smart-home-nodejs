FROM node:8
EXPOSE 3000
ADD . /nodeapp
WORKDIR /nodeapp
RUN npm install
WORKDIR /nodeapp/frontend
RUN npm install -g bower
RUN bower --allow-root install
WORKDIR /nodeapp
ENTRYPOINT [ "node", "index.js", "isLocal","disableReset"]
# ENTRYPOINT [ "node", "index.js", "smart-home=http://172.17.0.2:3000","disableReset"]
# ENTRYPOINT [ "node", "index.js", "smart-home=https://my-ddomain.org/smarthome","disableReset"]