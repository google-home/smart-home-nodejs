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
const authProvider = require('./cloud/auth-provider');

function registerAgent(app) {
  console.log('smart-home-app registerAgent');

  /**
   *
   * action: {
   *   initialTrigger: {
   *     intent: [
   *       "action.devices.SYNC",
   *       "action.devices.QUERY",
   *       "action.devices.EXECUTE"
   *     ]
   *   },
   *   httpExecution: "https://example.org/device/agent",
   *   accountLinking: {
   *     authenticationUrl: "https://example.org/device/auth"
   *   }
   * }
   */
  app.post('/smarthome', function(request, response) {
    console.log('post /smarthome', request.headers);
    let reqdata = request.body;
    console.log('post /smarthome', reqdata);

    let authToken = authProvider.getAccessToken(request);
    let uid = datastore.Auth.tokens[authToken].uid;

    if (!reqdata.inputs) {
      response.status(401).set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }).json({error: 'missing inputs'});
    }
    for (let i = 0; i < reqdata.inputs.length; i++) {
      let input = reqdata.inputs[i];
      let intent = input.intent;
      if (!intent) {
        response.status(401).set({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }).json({error: 'missing inputs'});
        continue;
      }
      switch (intent) {
        case 'action.devices.SYNC':
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
          sync({
            uid: uid,
            auth: authToken,
            requestId: reqdata.requestId,
          }, response);
          break;
        case 'action.devices.QUERY':
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
          query({
            uid: uid,
            auth: authToken,
            requestId: reqdata.requestId,
            devices: reqdata.inputs[0].payload.devices,
          }, response);

          break;
        case 'action.devices.EXECUTE':
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
          exec({
            uid: uid,
            auth: authToken,
            requestId: reqdata.requestId,
            commands: reqdata.inputs[0].payload.commands,
          }, response);

          break;
        default:
          response.status(401).set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }).json({error: 'missing intent'});
          break;
      }
    }
  });
  /**
   * Enables prelight (OPTIONS) requests made cross-domain.
   */
  app.options('/smarthome', function(request, response) {
    response.status(200).set({
      'Access-Control-Allow-Origin': '*',
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
  function sync(data, response) {
    console.log('sync', JSON.stringify(data));
    let devices = app.smartHomePropertiesSync(data.uid);
    if (!devices) {
      response.status(500).set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }).json({error: 'failed'});
      return;
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
      requestId: data.requestId,
      payload: {
        agentUserId: data.uid,
        devices: deviceList,
      },
    };
    console.log('sync response', JSON.stringify(deviceProps));
    response.status(200).json(deviceProps);
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
  function query(data, response) {
    console.log('query', JSON.stringify(data));
    let deviceIds = getDeviceIds(data.devices);

    let devices = app.smartHomeQueryStates(data.uid, deviceIds);
    if (!devices) {
      response.status(500).set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }).json({error: 'failed'});
      return;
    }
    let deviceStates = {
      requestId: data.requestId,
      payload: {
        devices: devices,
      },
    };
    console.log('query response', JSON.stringify(deviceStates));
    response.status(200).json(deviceStates);
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
  function exec(data, response) {
    console.log('exec', JSON.stringify(data));
    let respCommands = [];
    for (let i = 0; i < data.commands.length; i++) {
      let curCommand = data.commands[i];
      for (let j = 0; j < curCommand.execution.length; j++) {
        let curExec = curCommand.execution[j];
        let devices = curCommand.devices;
        for (let k = 0; k < devices.length; k++) {
          let executionResponse = execDevice(data.uid, curExec, devices[k]);
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
      requestId: data.requestId,
      payload: {
        commands: respCommands,
      },
    };
    console.log('exec response', JSON.stringify(resBody));
    response.status(200).json(resBody);
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
    app.changeState(deviceCommand);

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

exports.registerAgent = registerAgent;
