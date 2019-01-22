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

/* eslint require-jsdoc: "off" */
/* eslint valid-jsdoc: "off" */

const datastore = require('./cloud/datastore');
const config = require('./cloud/config-provider');
const authProvider = require('./cloud/auth-provider');
const {smarthome} = require('actions-on-google');
const bodyParser = require('body-parser');

let smartHomeApp;

function makeRequestId() {
  return new Date().getTime().toString();
}

function registerAgent(app) {
  console.log('smart-home-app registerAgent');

  smartHomeApp = smarthome({
    debug: true,
    jwt: config.jwt,
    key: config.smartHomeProviderApiKey,
  });

  app.use(bodyParser.json());

  app.post('/smarthome', (request, response, next) => {
    let authToken = authProvider.getAccessToken(request.headers);
    let uid = datastore.Auth.tokens[authToken].uid;

    if (!datastore.isValidAuth(uid, authToken)) {
      console.error('Invalid auth', authToken, 'for user', uid);
      response.status(403).set({
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }).json({error: 'invalid auth'});
      return;
    } else {
      next();
    }
  });


  app.post('/smarthome', smartHomeApp);

  smartHomeApp.onSync((body, headers) => {
    console.log('post /smarthome SYNC');
    /**
     * request:
     * {
     *  "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
     *  "inputs": [{
     *      "intent": "action.devices.SYNC",
     *  }]
     * }
     */
    return sync(body, headers);
  });

  smartHomeApp.onQuery((body, headers) => {
    console.log('post /smarthome QUERY');
    /**
     * request:
     * {
     *   "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
     *   "inputs": [{
     *       "intent": "action.devices.QUERY",
     *       "payload": {
     *          "devices": [{
     *            "id": "123",
     *            "customData": {
     *              "fooValue": 12,
     *              "barValue": true,
     *              "bazValue": "alpaca sauce"
     *            }
     *          }, {
     *            "id": "234",
     *            "customData": {
     *              "fooValue": 74,
     *              "barValue": false,
     *              "bazValue": "sheep dip"
     *            }
     *          }]
     *       }
     *   }]
     * }
     */
    return query(body, headers);
  });

  smartHomeApp.onExecute((body, headers) => {
    console.log('post /smarthome EXECUTE');
    /**
     * request:
     * {
     *   "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
     *   "inputs": [{
     *     "intent": "action.devices.EXECUTE",
     *     "payload": {
     *       "commands": [{
     *         "devices": [{
     *           "id": "123",
     *           "customData": {
     *             "fooValue": 12,
     *             "barValue": true,
     *             "bazValue": "alpaca sauce"
     *           }
     *         }, {
     *           "id": "234",
     *           "customData": {
     *              "fooValue": 74,
     *              "barValue": false,
     *              "bazValue": "sheep dip"
     *           }
     *         }],
     *         "execution": [{
     *           "command": "action.devices.commands.OnOff",
     *           "params": {
     *             "on": true
     *           }
     *         }]
     *       }]
     *     }
     *   }]
     * }
     */
    return exec(body, headers);
  });

  /**
   * Enables prelight (OPTIONS) requests made cross-domain.
   */
  app.options('/smarthome', function(request, response) {
    response.status(200).set({
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }).send('null');
  });

  /**
   *
   * @param data
   * {
   *   "uid": "213456",
   *   "auth": "bearer xxx",
   *   "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf"
   * }
   * @param response
   * @return {{}}
   * {
   *  "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
   *   "payload": {
   *     "devices": [{
   *         "id": "123",
   *         "type": "action.devices.types.Outlet",
   *         "traits": [
   *            "action.devices.traits.OnOff"
   *         ],
   *         "name": {
   *             "defaultNames": ["TP-Link Outlet C110"],
   *             "name": "Homer Simpson Light",
   *             "nicknames": ["wall plug"]
   *         },
   *         "willReportState: false,
   *         "attributes": {
   *         // None defined for these traits yet.
   *         },
   *         "roomHint": "living room",
   *         "config": {
   *           "manufacturer": "tplink",
   *           "model": "c110",
   *           "hwVersion": "3.2",
   *           "swVersion": "11.4"
   *         },
   *         "customData": {
   *           "fooValue": 74,
   *           "barValue": true,
   *           "bazValue": "sheepdip"
   *         }
   *       }, {
   *         "id": "456",
   *         "type": "action.devices.types.Light",
   *         "traits": [
   *           "action.devices.traits.OnOff",
   *           "action.devices.traits.Brightness",
   *           "action.devices.traits.ColorTemperature",
   *           "action.devices.traits.ColorSpectrum"
   *         ],
   *         "name": {
   *           "defaultNames": ["OSRAM bulb A19 color hyperglow"],
   *           "name": "lamp1",
   *           "nicknames": ["reading lamp"]
   *         },
   *         "willReportState: false,
   *         "attributes": {
   *           "TemperatureMinK": 2000,
   *           "TemperatureMaxK": 6500
   *         },
   *         "roomHint": "living room",
   *         "config": {
   *           "manufacturer": "osram",
   *           "model": "hg11",
   *           "hwVersion": "1.2",
   *           "swVersion": "5.4"
   *         },
   *         "customData": {
   *           "fooValue": 12,
   *           "barValue": false,
   *           "bazValue": "dancing alpaca"
   *         }
   *       }, {
   *         "id": "234"
   *         // ...
   *     }]
   *   }
   * }
   */
  function sync(request, headers) {
    console.log('sync', JSON.stringify(request));
    let authToken = authProvider.getAccessToken(headers);
    let uid = datastore.Auth.tokens[authToken].uid;

    let devices = app.smartHomePropertiesSync(uid);
    if (!devices) {
      return {
        error: 'failed',
      };
    }
    let deviceList = [];
    Object.keys(devices).forEach(function(key) {
      if (devices.hasOwnProperty(key) && devices[key]) {
        console.log('Getting device information for id \'' + key + '\'');
        let device = devices[key];
        device.id = key;
        deviceList.push(device);
      }
    });
    let deviceProps = {
      requestId: request.requestId,
      payload: {
        agentUserId: uid,
        devices: deviceList,
      },
    };
    console.log('sync response', JSON.stringify(deviceProps));
    return deviceProps;
  }

  /**
   *
   * @param data
   * {
   *   "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
   *   "uid": "213456",
   *   "auth": "bearer xxx",
   *   "devices": [{
   *     "id": "123",
   *       "customData": {
   *         "fooValue": 12,
   *         "barValue": true,
   *         "bazValue": "alpaca sauce"
   *       }
   *   }, {
   *     "id": "234"
   *   }]
   * }
   * @param response
   * @return {{}}
   * {
   *  "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
   *   "payload": {
   *     "devices": {
   *       "123": {
   *         "on": true ,
   *         "online": true
   *       },
   *       "456": {
   *         "on": true,
   *         "online": true,
   *         "brightness": 80,
   *         "color": {
   *           "name": "cerulian",
   *           "spectrumRGB": 31655
   *         }
   *       },
   *       ...
   *     }
   *   }
   * }
   */
  function query(request, headers) {
    console.log('query', JSON.stringify(request));
    let authToken = authProvider.getAccessToken(headers);
    let uid = datastore.Auth.tokens[authToken].uid;

    let deviceIds = getDeviceIds(request.inputs[0].payload.devices);

    let devices = app.smartHomeQueryStates(uid, deviceIds);
    if (!devices) {
      return {error: 'failed'};
    }
    let deviceStates = {
      requestId: request.requestId,
      payload: {
        devices: devices,
      },
    };
    console.log('query response', JSON.stringify(deviceStates));
    return deviceStates;
  }

  /**
   *
   * @param devices
   * [{
   *   "id": "123"
   * }, {
   *   "id": "234"
   * }]
   * @return {Array} ["123", "234"]
   */
  function getDeviceIds(devices) {
    let deviceIds = [];
    for (let i = 0; i < devices.length; i++) {
      if (devices[i] && devices[i].id) {
        deviceIds.push(devices[i].id);
      }
    }
    return deviceIds;
  }

  /**
   * @param data:
   * {
   *   "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
   *   "uid": "213456",
   *   "auth": "bearer xxx",
   *   "commands": [{
   *     "devices": [{
   *       "id": "123",
   *       "customData": {
   *          "fooValue": 74,
   *          "barValue": false
   *       }
   *     }, {
   *       "id": "456",
   *       "customData": {
   *          "fooValue": 12,
   *          "barValue": true
   *       }
   *     }, {
   *       "id": "987",
   *       "customData": {
   *          "fooValue": 35,
   *          "barValue": false,
   *          "bazValue": "sheep dip"
   *       }
   *     }],
   *     "execution": [{
   *       "command": "action.devices.commands.OnOff",
   *       "params": {
   *           "on": true
   *       }
   *     }]
   *  }
   *
   * @param response
   * @return {{}}
   * {
   *   "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
   *   "payload": {
   *     "commands": [{
   *       "ids": ["123"],
   *       "status": "SUCCESS"
   *       "states": {
   *         "on": true,
   *         "online": true
   *       }
   *     }, {
   *       "ids": ["456"],
   *       "status": "SUCCESS"
   *       "states": {
   *         "on": true,
   *         "online": true
   *       }
   *     }, {
   *       "ids": ["987"],
   *       "status": "OFFLINE",
   *       "states": {
   *         "online": false
   *       }
   *     }]
   *   }
   * }
   */
  function exec(request, headers) {
    console.log('exec', JSON.stringify(request));
    let authToken = authProvider.getAccessToken(headers);
    let uid = datastore.Auth.tokens[authToken].uid;

    let respCommands = [];
    let commands = request.inputs[0].payload.commands;
    for (let i = 0; i < commands.length; i++) {
      let curCommand = commands[i];
      for (let j = 0; j < curCommand.execution.length; j++) {
        let curExec = curCommand.execution[j];
        let devices = curCommand.devices;
        for (let k = 0; k < devices.length; k++) {
          let executionResponse = execDevice(uid, curExec, devices[k]);
          console.log('Device exec response',
              JSON.stringify(executionResponse));
          const execState = {};
          if (executionResponse.executionStates) {
            executionResponse.executionStates.map((key) => {
              execState[key] = executionResponse.states[key];
            });
          } else {
            console.warn('No execution states were found for this device');
          }
          respCommands.push({
            ids: [devices[k].id],
            status: executionResponse.status,
            errorCode: executionResponse.errorCode
                ? executionResponse.errorCode : undefined,
            states: execState,
          });
        }
      }
    }
    let resBody = {
      requestId: request.requestId,
      payload: {
        commands: respCommands,
      },
    };
    console.log('exec response', JSON.stringify(resBody));
    return resBody;
  }

  registerAgent.exec = exec;

  /**
   *
   * @param uid
   * @param command
   * {
   *   "command": "action.devices.commands.OnOff",
   *   "params": {
   *       "on": true
   *   }
   * }
   * @param device
   * {
   *   "id": "123",
   *   "customData": {
   *      "fooValue": 74,
   *      "barValue": false
   *   }
   * }
   * @return {{}}
   * {
   *   "ids": ["123"],
   *   "status": "SUCCESS"
   *   "states": {
   *     "on": true,
   *     "online": true
   *   }
   * }
   */
  function execDevice(uid, command, device) {
    let curDevice = {
      id: device.id,
      states: {},
    };
    Object.keys(command.params).forEach(function(key) {
      if (command.params.hasOwnProperty(key)) {
        curDevice.states[key] = command.params[key];
      }
    });
    let payLoadDevice = {
      ids: [curDevice.id],
      status: 'SUCCESS',
      states: {},
    };
    let execDevice = app.smartHomeExec(uid, curDevice);
    console.info('execDevice', JSON.stringify(execDevice[device.id]));
    // Check whether the device exists or whether
    // it exists and it is disconnected.
    if (!execDevice || !execDevice[device.id].states.online) {
      console.warn('The device you want to control is offline');
      return {status: 'ERROR', errorCode: 'deviceOffline'};
    }
    let deviceCommand = {
      type: 'change',
      state: {},
    };
    // TODO - add error and debug to response

    deviceCommand.state[curDevice.id] = execDevice[curDevice.id].states;
    app.changeState(deviceCommand)
      .catch((error) =>{
        console.error('changeState failed', error);
      });

    execDevice = execDevice[curDevice.id];

    payLoadDevice.states = execDevice.states;

    Object.keys(command.params).forEach(function(key) {
      if (command.params.hasOwnProperty(key)) {
        if (payLoadDevice.states[key] != command.params[key]) {
          return {status: 'ERROR', errorCode: 'notSupported'};
        }
      }
    });
    return {
      status: 'SUCCESS',
      states: execDevice.states,
      executionStates: execDevice.executionStates,
    };
  }
}

function requestSync(uid) {
  smartHomeApp.requestSync(uid)
  .then((res) => {
    console.log('requestSync success ' + res);
  })
  .catch((res) => {
    console.log('requestSync error ' + res);
  });
}

function reportState(uid, device) {
  if (!device.reportStates) {
    console.warn(`Device ${device.id} has no states to report`);
    return;
  }

  const reportedStates = {};
  device.reportStates.map((key) => {
    reportedStates[key] = device.states[key];
  });
  smartHomeApp.reportState( {
    requestId: makeRequestId(), // Any unique ID
    agentUserId: uid,
    payload: {
      devices: {
        states: {
          [device.id]: reportedStates,
        },
      },
    },
  })
  .then((res) => {
    console.log('reportState success ' + res);
  })
  .catch((res) => {
    console.log('reportState error ' + res);
  });
}

registerAgent.requestSync = requestSync;
registerAgent.reportState = reportState;

exports.registerAgent = registerAgent;
