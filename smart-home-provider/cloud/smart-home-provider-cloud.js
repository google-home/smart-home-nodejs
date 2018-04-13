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

const bodyParser = require('body-parser');
const express = require('express');
const fetch = require('node-fetch');
const morgan = require('morgan');
const ngrok = require('ngrok');
const session = require('express-session');

// internal app deps
const googleHa = require('../smart-home-app');
const datastore = require('./datastore');
const authProvider = require('./auth-provider');
const config = require('./config-provider');

// Check that the API key was changed from the default
if (config.smartHomeProviderApiKey === '<API_KEY>') {
  console.warn('You need to set the API key in config-provider.\n' +
    'Visit the Google Cloud Console to generate a key for your project.\n' +
    'https://console.cloud.google.com\n' +
    'Exiting...');
  process.exit();
}

const app = express();
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.set('trust proxy', 1); // trust first proxy
app.use(session({
  genid: (req) => {
    return authProvider.genRandomString();
  },
  secret: 'xyzsecret',
  resave: false,
  saveUninitialized: true,
  cookie: {secure: false},
}));
const deviceConnections = {};
// eslint-disable-next-line max-len
const requestSyncEndpoint = 'https://homegraph.googleapis.com/v1/devices:requestSync?key=';

/**
 * auth method
 *
 * required headers:
 * - Authorization
 *
 * TODO: Consider using the "cors" module (https://github.com/expressjs/cors) to
 *       simplify CORS responses.
 * TODO: Consider moving auth checks into its own request handler/middleware
 *       (http://expressjs.com/en/guide/writing-middleware.html)
 */
app.post('/smart-home-api/auth', (request, response) => {
  let authToken = authProvider.getAccessToken(request);
  let uid = datastore.Auth.tokens[authToken].uid;

  if (!uid || !authToken) {
    response.status(401).set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }).json({error: 'missing auth headers'});
    return;
  }

  datastore.registerUser(uid, authToken);

  if (!datastore.isValidAuth(uid, authToken)) {
    response.status(403).set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }).json({success: false, error: 'failed auth'});
    return;
  }

  response.status(200)
    .set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    .send({success: true});
});

/**
 * Can be used to register a device.
 * Removing a device would be supplying the device id without any traits.
 *
 * requires auth headers
 *
 * body should look like:
 * {
 *   id: <device id>,
 *   properties: {
 *      type: <>,
 *      name: {},
 *      ...
 *   },
 *   state: {
 *      on: true,
 *      ...
 *   }
 * }
 */
app.post('/smart-home-api/register-device', (request, response) => {
  let authToken = authProvider.getAccessToken(request);
  let uid = datastore.Auth.tokens[authToken].uid;

  if (!datastore.isValidAuth(uid, authToken)) {
    console.error('Invalid auth', authToken, 'for user', uid);
    response.status(403).set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }).json({error: 'invalid auth'});
    return;
  }

  let device = request.body;
  datastore.registerDevice(uid, device);

  let registeredDevice = datastore.getStatus(uid, [device.id]);
  if (!registeredDevice || !registeredDevice[device.id]) {
    response.status(401).set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }).json({error: 'failed to register device'});
    return;
  }

  app.requestSync(authToken, uid);

  // otherwise, all good!
  response.status(200)
    .set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    .send(registeredDevice);
});

/**
 * Can be used to reset all devices for a user account.
 */
app.post('/smart-home-api/reset-devices', (request, response) => {
  let authToken = authProvider.getAccessToken(request);
  let uid = datastore.Auth.tokens[authToken].uid;

  if (!datastore.isValidAuth(uid, authToken)) {
    console.error('Invalid auth', authToken, 'for user', uid);
    response.status(403).set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }).json({error: 'invalid auth'});
    return;
  }

  // eslint-disable-next-line no-unused-vars
  let device = request.body;
  // Only complete the reset if this is enabled.
  // If the developer disables this, the request will succeed
  // without doing anything.
  if (config.enableReset) {
    datastore.resetDevices(uid);

    // Resync for the user
    app.requestSync(authToken, uid);
  }

  // otherwise, all good!
  response.status(200)
    .set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    .send(datastore.getUid(uid));
});

/**
 * Can be used to unregister a device.
 * Removing a device would be supplying the device id without any traits.
 */
app.post('/smart-home-api/remove-device', (request, response) => {
  let authToken = authProvider.getAccessToken(request);
  let uid = datastore.Auth.tokens[authToken].uid;

  if (!datastore.isValidAuth(uid, authToken)) {
    console.error('Invalid auth', authToken, 'for user', uid);
    response.status(403).set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }).json({error: 'invalid auth'});
    return;
  }

  let device = request.body;
  datastore.removeDevice(uid, device);

  let removedDevice = datastore.getStatus(uid, [device.id]);
  if (removedDevice[device.id]) {
    response.status(500).set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }).json({error: 'failed to remove device'});
    return;
  }

  app.requestSync(authToken, uid);

  // otherwise, all good!
  response.status(200)
    .set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    .send(datastore.getUid(uid));
});

/**
 * Can be used to modify state of a device, or to add or remove a device.
 * Removing a device would be supplying the device id without any traits.
 *
 * requires auth headers
 *
 * body should look like:
 * {
 *   id: <device id>,
 *   type: <device type>,
 *   <trait name>: <trait value>,
 *   ...
 * }
 */
app.post('/smart-home-api/exec', (request, response) => {
  let authToken = authProvider.getAccessToken(request);
  let uid = datastore.Auth.tokens[authToken].uid;

  if (!datastore.isValidAuth(uid, authToken)) {
    response.status(403).set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }).json({error: 'invalid auth'});
    return;
  }

  let executedDevice = app.smartHomeExec(uid, request.body);
  if (!executedDevice || !executedDevice[request.body.id]) {
    response.status(500).set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }).json({error: 'failed to exec device'});
    return;
  }

  if (request.body.nameChanged) {
    console.log('calling request sync from exec to update name');
    app.requestSync(authToken, uid);
  }

  // otherwise, all good!
  response.status(200)
    .set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    .send(executedDevice);
});

app.post('/smart-home-api/execute-scene', (request, response) => {
  let authToken = authProvider.getAccessToken(request);
  let uid = datastore.Auth.tokens[authToken].uid;

  reqdata = request.body;
  data = {
    requestId: reqdata.requestId,
    uid: uid,
    auth: authToken,
    commands: reqdata.inputs[0].payload.commands,
  };

  return googleHa.registerAgent.exec(data, response);
});

/**
 * This is how to query.
 *
 * req body:
 * [<device id>,...] // (optional)
 *
 * response:
 * {
 *   <device id>: {
 *     <trait name>: <trait value>,
 *     <trait name>: <trait value>,
 *     <trait name>: <trait value>,
 *     ...
 *   },
 *   <device id>: {
 *     <trait name>: <trait value>,
 *     <trait name>: <trait value>,
 *     <trait name>: <trait value>,
 *     ...
 *   },
 * }
 */
app.post('/smart-home-api/status', (request, response) => {
  // console.log('post /smart-home-api/status');

  let authToken = authProvider.getAccessToken(request);
  let uid = datastore.Auth.tokens[authToken].uid;

  if (!datastore.isValidAuth(uid, authToken)) {
    response.status(403).set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }).json({error: 'invalid auth'});
    return;
  }

  let devices = app.smartHomeQuery(uid, request.body);

  if (!devices) {
    response.status(500).set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }).json({error: 'failed to get device'});
    return;
  }

  // otherwise, all good!
  response.status(200)
    .set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    .send(devices);
});

/**
 * Creates an Server Send Event source for a device.
 * Called from a device.
 */
app.get('/smart-home-api/device-connection/:deviceId', (request, response) => {
  const deviceId = request.params.deviceId;
  // console.log('get /smart-home-api/device-connection/' + deviceId);
  deviceConnections[deviceId] = response;

  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  response.connection.setTimeout(0);
  response.on('close', () => {
    delete deviceConnections[deviceId];
  });
});

// frontend UI
app.set('jsonp callback name', 'cid');

app.get('/getauthcode', (req, resp) => {
  /* forbid caching to force reload of getauthcode */
  resp.set('Cache-Control', 'no-store, must-revalidate');
  /* set correct mime type else browser will refuse to execute the script*/
  resp.set('Content-Type', 'text/javascript');

  if (!req.session.user) {
    resp.status(200).send('' +
      '(function(){' +
      'window.location.replace("/login?client_id=' +
      config.smartHomeProviderGoogleClientId +
      '&redirect_uri=/frontend&state=cool_jazz")' +
      '})();' +
      '');// redirect to login
  } else {
    resp.status(200).send('' +
      'var AUTH_TOKEN = "' + req.session.user.tokens[0] + '";' +
      'var USERNAME = "' + req.session.user.name + '";' +
      '');
  }
});
app.use('/frontend', express.static('./frontend'));
app.use('/frontend/', express.static('./frontend'));
app.use('/', express.static('./frontend'));

app.smartHomeSync = (uid) => {
  // console.log('smartHomeSync');
  let devices = datastore.getStatus(uid, null);
  // console.log('smartHomeSync devices: ', devices);
  return devices;
};

app.smartHomePropertiesSync = (uid) => {
  // console.log('smartHomePropertiesSync');
  let devices = datastore.getProperties(uid, null);
  // console.log('smartHomePropertiesSync devices: ', devices);
  return devices;
};

app.smartHomeQuery = (uid, deviceList) => {
  // console.log('smartHomeQuery deviceList: ', deviceList);
  if (!deviceList || deviceList == {}) {
    // console.log('using empty device list');
    deviceList = null;
  }
  let devices = datastore.getStatus(uid, deviceList);
  // console.log('smartHomeQuery devices: ', devices);
  return devices;
};

app.smartHomeQueryStates = (uid, deviceList) => {
  // console.log('smartHomeQueryStates deviceList: ', deviceList);
  if (!deviceList || deviceList == {}) {
    // console.log('using empty device list');
    deviceList = null;
  }
  let devices = datastore.getStates(uid, deviceList);
  // console.log('smartHomeQueryStates devices: ', devices);
  return devices;
};

app.smartHomeExec = (uid, device) => {
  // console.log('smartHomeExec', device);
  datastore.execDevice(uid, device);
  let executedDevice = datastore.getStatus(uid, [device.id]);
  console.log('smartHomeExec executedDevice', JSON.stringify(executedDevice));
  return executedDevice;
};

app.changeState = (command) => {
  return new Promise((resolve, reject) => {
    if (command.type == 'change') {
      for (let deviceId in command.state) {
        const deviceChanges = command.state[deviceId];
        // console.log('>>> changeState: deviceChanges', deviceChanges);

        const connection = deviceConnections[deviceId];
        if (!connection) {
          // console.log('>>> changeState: connection not found for', deviceId);
          return reject(new Error('Device ' + deviceId +
            ' unknown to Amce Cloud'));
        }

        connection.write('event: change\n');
        connection.write('data: ' + JSON.stringify(deviceChanges) + '\n\n');
      }
      resolve();
    } else if (command.type == 'delete') {
      reject(new Error('Device deletion unimplemented'));
    } else {
      reject(new Error('Unknown change type "' + command.type + '"'));
    }
  });
};

app.requestSync = (authToken, uid) => {
  // REQUEST_SYNC
  const apiKey = config.smartHomeProviderApiKey;
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  };
  optBody = {
    'agentUserId': uid,
  };
  options.body = JSON.stringify(optBody);
  console.info('POST REQUEST_SYNC', requestSyncEndpoint + apiKey);
  console.info(`POST payload: ${JSON.stringify(options)}`);
  fetch(requestSyncEndpoint + apiKey, options)
    .then((res) => {
      console.log('request-sync response', res.status, res.statusText);
    });
};

const appPort = process.env.PORT || config.devPortSmartHome;

const server = app.listen(appPort, () => {
  const host = server.address().address;
  const port = server.address().port;

  console.log('Smart Home Cloud and App listening at %s:%s', host, port);

  if (config.isLocal) {
    ngrok.connect(config.devPortSmartHome, (err, url) => {
      if (err) {
        console.log('ngrok err', err);
        process.exit();
      }

      console.log('|###################################################|');
      console.log('|                                                   |');
      console.log('|        COPY & PASTE NGROK URL BELOW:              |');
      console.log('|                                                   |');
      console.log('|          ' + url + '                |');
      console.log('|                                                   |');
      console.log('|###################################################|');

      console.log('=====');
      console.log('Visit the Actions on Google console at http://console.actions.google.com');
      console.log('Replace the webhook URL in the Actions section with:');
      console.log('    ' + url + '/smarthome');

      console.log('In the console, set the Authorization URL to:');
      console.log('    ' + url + '/oauth');

      console.log('');
      console.log('Then set the Token URL to:');
      console.log('    ' + url + '/token');
      console.log('');

      console.log('Finally press the \'TEST DRAFT\' button');
    });
  }
});

registerGoogleHa = (app) => {
  googleHa.registerAgent(app);
};

registerAuth = (app) => {
  authProvider.registerAuth(app);
};

registerGoogleHa(app);
registerAuth(app);

console.log('\n\nRegistered routes:');
app._router.stack.forEach((r) => {
  if (r.route && r.route.path) {
    console.log(r.route.path);
  }
});

