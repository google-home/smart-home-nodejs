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

/**
 * Structure of Data
 * {
 *   <uid>: {
 *     <device id>: {
 *       properties: {
 *         <property name>: <property value>,
 *         <property name>: <property value>
 *       },
 *       states: {
 *         <state name>: <state value>,
 *         <state name>: <state value>
 *       }
 *     },
 *     <device id>: {...}
 *   },
 *   <uid>: {
 *     <device id>: {...},
 *     <device id>: {...},
 *     <device id>: {...}
 *   },
 *   ...
 * }
 */

const config = require('./config-provider');
const fs = require('fs');
let Data = {
  version: 0,
};

/**
 * Structure of Auth
 * {
 *   clients: {
 *      <client id>:
 *          clientSecret: <value>,
 *          uid: <value>
 *      }
 *   },
 *   tokens: {
 *      <token id>: {
 *          <uid>: {}
 *      },
 *   },
 *   users: {
 *      <uid>: {
 *          name: <username>,
 *          password: <password>,
 *          tokens: [<token id>, ...],
 *          clients: [<client id>, ...]
 *      }
 *   }
 * }
 * @type {{}}
 */

/*
 * This is a set of hardcoded Auth clients and users (and their access tokens)
 * for testing this mock OAuth server. These fake users can be used just to
 * test the service. This is not real user data.
 */
let Auth = {
  clients: {
    'RKkWfsi0Z9': {
      clientId: 'RKkWfsi0Z9',
      clientSecret: 'eToBzeBT7OwrPQO8mZHsZtLp1qhQbe',
    },
    'ZxjqWpsYj3': {
      clientId: 'ZxjqWpsYj3',
      clientSecret: 'hIMH3uWlMVrqa7FAbKLBoNUMCyLCtv',
    },
  },
  tokens: {
    'psokmCxKjfhk7qHLeYd1': {
      uid: '1234',
      accessToken: 'psokmCxKjfhk7qHLeYd1',
      refreshToken: 'psokmCxKjfhk7qHLeYd1',
      userId: '1234',
    },
    'bfrrLnxxWdULSh3Y9IU2cA5pw8s4ub': {
      uid: '2345',
      accessToken: 'bfrrLnxxWdULSh3Y9IU2cA5pw8s4ub',
      refreshToken: 'bfrrLnxxWdULSh3Y9IU2cA5pw8s4ub',
      userId: '2345',
    },
    'kmjWldncnpr2drPCIe8n5TWvNEqqz8': {
      uid: '3456',
      accessToken: 'kmjWldncnpr2drPCIe8n5TWvNEqqz8',
      refreshToken: 'kmjWldncnpr2drPCIe8n5TWvNEqqz8',
      userId: '3456',
    },
    'CyZEA3izOsFoTd9hH76atzStqrSYVY': {
      uid: '4567',
      accessToken: 'CyZEA3izOsFoTd9hH76atzStqrSYVY',
      refreshToken: 'CyZEA3izOsFoTd9hH76atzStqrSYVY',
      userId: '4567',
    },
    'JK0u11W5jFXOCZCqUzF9zf9pnNZcim': {
      uid: '5678',
      accessToken: 'JK0u11W5jFXOCZCqUzF9zf9pnNZcim',
      refreshToken: 'JK0u11W5jFXOCZCqUzF9zf9pnNZcim',
      userId: '5678',
    },
    '2E1KuI3rQsrj51JyWs66nAShZwMliL': {
      uid: '6789',
      accessToken: '2E1KuI3rQsrj51JyWs66nAShZwMliL',
      refreshToken: '2E1KuI3rQsrj51JyWs66nAShZwMliL',
      userId: '6789',
    },
    '0EFBxAWH9iBYySHFQm5xpji8LWdlxg': {
      uid: '7890',
      accessToken: '0EFBxAWH9iBYySHFQm5xpji8LWdlxg',
      refreshToken: '0EFBxAWH9iBYySHFQm5xpji8LWdlxg',
      userId: '7890',
    },
    '7TX3ExuETedX8WneDT48': {
      uid: '4321',
      accessToken: '7TX3ExuETedX8WneDT48',
      refreshToken: '7TX3ExuETedX8WneDT48',
      userId: '4321',
    },
  },
  users: {
    '1234': {
      uid: '1234',
      name: 'rick',
      password: 'oldman',
      tokens: ['psokmCxKjfhk7qHLeYd1'],
    },
    '2345': {
      uid: '2345',
      name: 'summer',
      password: 'tr0y',
      tokens: ['bfrrLnxxWdULSh3Y9IU2cA5pw8s4ub'],
    },
    '3456': {
      uid: '3456',
      name: 'beth',
      password: 'doctor',
      tokens: ['kmjWldncnpr2drPCIe8n5TWvNEqqz8'],
    },
    '4567': {
      uid: '4567',
      name: 'jerry',
      password: 'b3th',
      tokens: ['CyZEA3izOsFoTd9hH76atzStqrSYVY'],
    },
    '5678': {
      uid: '5678',
      name: 'birdperson',
      password: 'tammy',
      tokens: ['JK0u11W5jFXOCZCqUzF9zf9pnNZcim'],
    },
    '6789': {
      uid: '6789',
      name: 'squanchy',
      password: 'squanchy',
      tokens: ['2E1KuI3rQsrj51JyWs66nAShZwMliL'],
    },
    '7890': {
      uid: '7890',
      name: 'jessica',
      password: 'br4d',
      tokens: ['0EFBxAWH9iBYySHFQm5xpji8LWdlxg'],
    },
    '4321': {
      uid: '4321',
      name: 'morty',
      password: 'j3ssica',
      tokens: ['7TX3ExuETedX8WneDT48'],
    },
  },
  usernames: {
    'rick': '1234',
    'summer': '2345',
    'beth': '3456',
    'jerry': '4567',
    'birdperson': '5678',
    'squanchy': '6789',
    'jessica': '7890',
    'morty': '4321',
  },
  authcodes: {},
};

Auth.clients[config.smartHomeProviderGoogleClientId] = {
  clientId: config.smartHomeProviderGoogleClientId,
  clientSecret: config.smartHomeProvideGoogleClientSecret,
};

writeData = function(filename, data) {
  fs.writeFile(filename, JSON.stringify(data, null, 2), 'utf8', (err) => {
    if (err) {
      console.log(err);
    }
  });
};

readDataAuth = function() {
  fs.readFile('auth.json', 'utf8', (err, data) => {
    if (err) {
      console.log(err);
    } else {
      Auth = JSON.parse(data);
      console.log(Auth);
    }
  });
};

readData = function() {
  fs.readFile('data.json', 'utf8', (err, data) => {
    if (err) {
      console.log(err);
    } else {
      Data = JSON.parse(data);
      console.log(Data);
    }
  });
};

init = function() {
  readDataAuth();
  readData();
};


/**
 * get a full status for everything stored for a user
 *
 * @param uid
 * @return
 * {
 *   uid: <uid>,
 *   devices: {
 *     <device id>: {
 *       properties: {
 *         <property name>: <property value>,
 *         <property name>: <property value>
 *       },
 *       states: {
 *         <state name>: <state value>,
 *         <state name>: <state value>
 *       }
 *     },
 *     <device id>: {...},
 *     ...
 *   }
 * }
 */
getUid = function(uid) {
  // console.log('getUid', uid);
  return Data[uid];
};

/**
 * get current states for all devices stored for a user
 *
 * @param uid
 * @param deviceIds
 * @return
 * {
 *   <device id>: {
 *     <state name>: <state value>,
 *     <state name>: <state value>
 *   },
 *   <device id>: {...},
 * }
 */
getStates = function(uid, deviceIds = undefined) {
  // console.log('getStates', uid);
  let states = {};

  if (!deviceIds) {
    Object.keys(Data[uid]).forEach(function(deviceId) {
      if (Data[uid].hasOwnProperty(deviceId)) {
        states[deviceId] = Data[uid][deviceId].states;
      }
    });
  } else {
    for (let i = 0; i < deviceIds.length; i++) {
      let deviceId = deviceIds[i];
      if (Data[uid].hasOwnProperty(deviceId)) {
        states[deviceId] = Data[uid][deviceId].states;
      }
    }
  }

  return states;
};

/**
 * get current states for all devices stored for a user
 *
 * @param uid
 * @param deviceIds
 * @return
 * {
 *   <device id>: {
 *     <property name>: <property value>,
 *     <property name>: <property value>
 *   },
 *   <device id>: {...},
 * }
 */
getProperties = function(uid, deviceIds = undefined) {
  // console.log('getProperties', uid);
  let properties = {};

  if (!deviceIds) {
    if (!Data.hasOwnProperty(uid)) {
      return properties;
    }
    Object.keys(Data[uid]).forEach(function(deviceId) {
      if (Data[uid].hasOwnProperty(deviceId)) {
        properties[deviceId] = Data[uid][deviceId].properties;
      }
    });
  } else {
    for (let i = 0; i < deviceIds.length; i++) {
      let deviceId = deviceIds[i];
      if (Data[uid].hasOwnProperty(deviceId)) {
        properties[deviceId] = Data[uid][deviceId].properties;
      }
    }
  }

  return properties;
};

/**
 * get a status for the passed in device ids, otherwise get a full status
 *
 * @param uid
 * @param deviceIds (optional)
 * @return
 * {
 *   uid: <uid>,
 *   devices: {
 *     <device id>: {
 *       properties: {
 *         <property name>: <property value>,
 *         <property name>: <property value>
 *       },
 *       states: {
 *         <state name>: <state value>,
 *         <state name>: <state value>
 *       }
 *     },
 *     <device id>: {...},
 *     ...
 *   }
 * }
 */
  getStatus = function(uid, deviceIds = undefined) {
  // return Data.getUid(uid);
  if (!Data[uid]) {
    console.error('cannot getStatus of devices without first registering ' +
        'the user!');
    return;
  }

  // console.log('getStatus deviceIds', deviceIds);
  if (!deviceIds || deviceIds == {} ||
      (Object.keys(deviceIds).length === 0
          && deviceIds.constructor === Object)) {
    return getUid(uid);
  }

  let devices = {};
  for (let i = 0; i < deviceIds.length; i++) {
    let curId = deviceIds[i];
    if (!Data[uid][curId]) {
      continue;
    }
    devices[curId] = Data[uid][curId];
    // console.log('devices[curId]', devices[curId]);
  }
  // console.log('devices', devices);
  return devices;
};

/**
 * register or update a user's data
 *
 * @param uid
 * @param authToken
 */
registerUser = function(uid, authToken) {
  if (!authToken) {
    console.error('cannot register a user without an authToken!');
    return;
  }
  if (!Data[uid]) {
    Data[uid] = {};
  }
  Auth[uid] = authToken;
  Data.version++;
  writeData('data.json', Data);
  writeData('auth.json', Auth);
};

/**
 * removes a user from authstore
 *
 * @param uid
 * @param authToken
 */
removeUser = function(uid, authToken) {
  if (!authToken) {
    console.error('cannot remove a user without an authToken!');
    return;
  }
  if (!Data.isValidAuth(uid, authToken)) {
    console.error('cannot remove a user with mis-matched authToken!');
    return;
  }
  delete Data[uid];
  delete Auth[uid];
  Data.version++;
  writeData('data.json', Data);
  writeData('auth.json', Auth);
};

/**
 * update a device
 *
 * @param uid
 * @param device
 * {
 *   states: {
 *     on: true,
 *     online: true
 *      ...
 *   },
 *   properties: {
 *     name: "smart home light 1",
 *     firmware: "1fzxa84232n4nb6478n8",
 *     traits: ["onoff"],
 *     nickname: "kitchen light",
 *     type: "light",
 *      ...
 *   }
 * }
 */
execDevice = function(uid, device) {
  if (!Data[uid]) {
    console.error('cannot register a device without first registering ' +
      'the user!');
    return;
  }
  // console.log('execDevice', device);
  if (!Data[uid][device.id]) {
    Data[uid][device.id] = {
      states: {},
      properties: {},
      executionStates: [],
    };
  }
  if (device.hasOwnProperty('properties')) {
    // update properties
    Object.keys(device.properties).forEach(function(key) {
      if (device.properties.hasOwnProperty(key)) {
        // console.log('property ' + key, device.properties[key]);
        Data[uid][device.id].properties[key] = device.properties[key];
      }
    });
  }
  if (device.hasOwnProperty('states')) {
    // update states
    Object.keys(device.states).forEach(function(key) {
      if (device.states.hasOwnProperty(key)) {
        // console.log('state ' + key, device.states[key]);
        Data[uid][device.id].states[key] = device.states[key];
      }
    });
  }
  if (device.hasOwnProperty('executionStates')) {
    // update array of states
    Data[uid][device.id].executionStates = device.executionStates;
  }
  if (device.hasOwnProperty('reportStates')) {
    // update array of states
    Data[uid][device.id].reportStates = device.reportStates;
  }
  // console.log('execDevice after', Data[uid][device.id]);
  Data.version++;
  writeData('data.json', Data);
};

/**
 * register or update a device
 *
 * @param uid
 * @param device
 */
registerDevice = function(uid, device) {
  // wrapper for exec, since they do the same thing
  execDevice(uid, device);
};

/**
 * resets user account, deleting all devices on page refresh
 */
resetDevices = function(uid) {
  // Deletes all devices for the user.
  if (!Data[uid]) {
    console.error('cannot remove a device without first registering the user!');
    return;
  }
  console.info('Deleting all devices for ' + uid);
  Data[uid] = {};
  Data.version = 0;
  writeData('data.json', Data);
};

/**
 * removes a device from authstore
 *
 * @param uid
 * @param device
 */
removeDevice = function(uid, device) {
  if (!Data[uid]) {
    console.error('cannot remove a device without first registering the user!');
    return;
  }
  console.info('Deleting device ' + device.id + ' for ' + uid);
  delete Data[uid][device.id];
  Data.version++;
  writeData('data.json', Data);
};

/**
 * checks if user and auth exist and match
 *
 * @param uid
 * @param authToken
 * @return {boolean}
 */
isValidAuth = function(uid, authToken) {
  return (getUid(uid));

  // FIXME - reenable below once a more stable auth has been put in place
  // if (!Data.getUid(uid) || !Auth[uid])
  //     return false;
  // return (authToken == Auth[uid]);
};

exports.getUid = getUid;
exports.getStatus = getStatus;
exports.getStates = getStates;
exports.getProperties = getProperties;
exports.isValidAuth = isValidAuth;
exports.registerUser = registerUser;
exports.removeUser = removeUser;
exports.execDevice = execDevice;
exports.registerDevice = registerDevice;
exports.resetDevices = resetDevices;
exports.removeDevice = removeDevice;
exports.Auth = Auth;
exports.init = init;
