// Copyright 2017, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const https = require('https');
const querystring = require('querystring');
const url = require('url');

function init() {

  let doHelp = false,
    doSync = false,
    doQuery = false,
    doExec = false;
  let endpoint = 'https://example.com/ha';

  process.argv.forEach(function (value, i, arr) {
    console.log(value);
    if (value.includes('help'))
      doHelp = true;
    else if (value.includes('sync'))
      doSync = true;
    else if (value.includes('query'))
      doQuery = true;
    else if (value.includes('exec'))
      doExec = true;
    else if (value.includes('url='))
      endpoint = value.split('=')[1];
  });

  if (doHelp || !endpoint || (!doSync && !doQuery && !doExec)) {
    console.log(doHelp, !endpoint, !doSync, !doQuery, !doExec);
    console.log("============================== platform.js ==================================");
    console.log(" ");
    console.log("Google Home Control mock requests");
    console.log(" ");
    console.log("Usage:");
    console.log(" ");
    console.log("url=< http://example.com/ha > - your Home Control agent server");
    console.log("url defaults to the public endpoint at smart-home-provider-test.appspot.com");
    console.log(" ");
    console.log("Then one or more of the following flags:");
    console.log("* sync - flag to send sync intent");
    console.log("* query - flag to send query intent");
    console.log("* exec - flag to send exec intent");
    console.log(" ");
    console.log("Ex. - node platform url=\"https://smart-home-provider-test.appspot.com/ha\" sync");
    console.log(" ");
    console.log("============================================================================");
    return;
  }

  if (doSync)
    sync(endpoint);
  if (doQuery)
    query(endpoint);
  if (doExec)
    exec(endpoint);
}

function sync(endpoint) {
  let postData = JSON.stringify({
    "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
    "inputs": [{
      "intent": "action.devices.SYNC"
    }]
  });

  makeReq(endpoint, postData);
}

function query(endpoint) {
  let postData = JSON.stringify({
    "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
    "inputs": [{
      "intent": "action.devices.QUERY",
      "payload": {
        "devices": [{
          "id": "1",
          "customData": {
            "smartHomeProviderId": "FkldJVJCmDNSaoLkoq0txiz8Byf2Hr"
          }
        }, {
          "id": "2",
          "customData": {
            "smartHomeProviderId": "FkldJVJCmDNSaoLkoq0txiz8Byf2Hr"
          }
        }, {
          "id": "3",
          "customData": {
            "smartHomeProviderId": "FkldJVJCmDNSaoLkoq0txiz8Byf2Hr"
          }
        }, {
          "id": "4",
          "customData": {
            "smartHomeProviderId": "FkldJVJCmDNSaoLkoq0txiz8Byf2Hr"
          }
        }]
      }
    }]
  });
  makeReq(endpoint, postData);
}

function exec(endpoint) {
  let postData = JSON.stringify({
    "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
    "inputs": [{
      "intent": "action.devices.EXECUTE",
      "payload": {
        "commands": [{
          "devices": [{
            "id": "1",
            "customData": {
              "smartHomeProviderId": "FkldJVJCmDNSaoLkoq0txiz8Byf2Hr"
            }
          }, {
            "id": "3",
            "customData": {
              "smartHomeProviderId": "FkldJVJCmDNSaoLkoq0txiz8Byf2Hr"
            }
          }],
          "execution": [{
            "command": "action.devices.commands.Brightness",
            "params": {
              "brightness": 60
            }
          }, {
            "command": "action.devices.commands.ChangeColor",
            "params": {
              "color": {
                "name": "cerulian",
                "spectrumRGB": 523435
              }
            }
          }, {
            "command": "action.devices.commands.OnOff",
            "params": {
              "on": true
            }
          }]
        }]
      }
    }]
  });
  makeReq(endpoint, postData);
}

function makeReq(endpoint, postData) {
  let haUrl = url.parse(endpoint);
  let options = {
    hostname: haUrl.hostname,
    port: haUrl.port,
    path: haUrl.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Authorization': 'Bearer psokmCxKjfhk7qHLeYd1'
    }
  };
  console.log(`Options: ${JSON.stringify(options)}`);
  console.log(`postData: ${postData}`);

  let req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      console.log(chunk);
    });
    res.on('end', () => {
      console.log('');
    });
  });

  req.on('error', (e) => {
    console.log(`problem with request: ${e.message}`);
  });

  // write data to request body
  req.write(postData);
  req.end();

}

init();
