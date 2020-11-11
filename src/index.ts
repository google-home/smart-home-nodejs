/* Copyright 2017, Google, Inc.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * This is the main server code that processes requests and sends responses
 * back to users and to the HomeGraph.
 */

// Express imports
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import morgan from 'morgan';
import ngrok from 'ngrok';
import net from 'net';
import fs from 'fs';
import path from 'path';

// Smart home imports
import {
  smarthome,
  SmartHomeV1ExecuteResponseCommands,
  Headers,
} from 'actions-on-google';

// Local imports
import * as Firestore from './firestore';
import * as Auth from './auth-provider';
import * as Config from './config-provider';

const expressApp = express();
expressApp.use(cors());
expressApp.use(morgan('dev'));
expressApp.use(bodyParser.json());
expressApp.use(bodyParser.urlencoded({extended: true}));
expressApp.set('trust proxy', 1);

Auth.registerAuthEndpoints(expressApp);

let jwt;
try {
  jwt = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'smart-home-key.json')).toString()
  );
} catch (e) {
  console.warn('Service account key is not found');
  console.warn('Report state and Request sync will be unavailable');
}

const app = smarthome({
  jwt,
  debug: true,
});

// Array could be of any type
async function asyncForEach<T>(array: T[], callback: Function) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

async function getUserIdOrThrow(headers: Headers): Promise<string> {
  const userId = await Auth.getUser(headers);
  const userExists = await Firestore.userExists(userId);
  if (!userExists) {
    throw new Error(
      `User ${userId} has not created an account, so there are no devices`
    );
  }
  return userId;
}

async function reportState(
  agentUserId: string,
  deviceId: string,
  states: Firestore.StatesMap
) {
  console.log(`Reporting state payload for ${deviceId}`, states);
  // Report state back to Homegraph
  // Do state name replacement for ColorSetting trait
  // See https://developers.google.com/assistant/smarthome/traits/colorsetting#device-states
  if (states.color && typeof states.color.spectrumRgb === 'number') {
    states.color.spectrumRGB = states.color.spectrumRgb;
    delete states.color.spectrumRgb;
  }

  return await app.reportState({
    agentUserId,
    requestId: Math.random().toString(),
    payload: {
      devices: {
        states: {
          [deviceId]: states,
        },
      },
    },
  });
}

app.onSync(async (body, headers) => {
  const userId = await getUserIdOrThrow(headers);
  await Firestore.setHomegraphEnable(userId, true);

  const devices = await Firestore.getDevices(userId);
  return {
    requestId: body.requestId,
    payload: {
      agentUserId: userId,
      devices,
    },
  };
});

interface DeviceStatesMap {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
app.onQuery(async (body, headers) => {
  const userId = await getUserIdOrThrow(headers);
  const deviceStates: DeviceStatesMap = {};
  const {devices} = body.inputs[0].payload;
  await asyncForEach(devices, async (device: {id: string}) => {
    try {
      const states = await Firestore.getState(userId, device.id);
      deviceStates[device.id] = {
        ...states,
        status: 'SUCCESS',
      };
    } catch (e) {
      console.error(e);
      deviceStates[device.id] = {
        status: 'ERROR',
        errorCode: 'deviceOffline',
      };
    }
  });

  return {
    requestId: body.requestId,
    payload: {
      devices: deviceStates,
    },
  };
});

app.onExecute(async (body, headers) => {
  const userId = await getUserIdOrThrow(headers);
  const commands: SmartHomeV1ExecuteResponseCommands[] = [];
  const successCommand: SmartHomeV1ExecuteResponseCommands = {
    ids: [],
    status: 'SUCCESS',
    states: {},
  };

  const {devices, execution} = body.inputs[0].payload.commands[0];
  await asyncForEach(devices, async (device: {id: string}) => {
    try {
      const states = await Firestore.execute(userId, device.id, execution[0]);
      successCommand.ids.push(device.id);
      successCommand.states = states;
      await reportState(userId, device.id, states);
    } catch (e) {
      console.error(e);
      if (e.message === 'pinNeeded') {
        commands.push({
          ids: [device.id],
          status: 'ERROR',
          errorCode: 'challengeNeeded',
          challengeNeeded: {
            type: 'pinNeeded',
          },
        });
        return;
      } else if (e.message === 'challengeFailedPinNeeded') {
        commands.push({
          ids: [device.id],
          status: 'ERROR',
          errorCode: 'challengeNeeded',
          challengeNeeded: {
            type: 'challengeFailedPinNeeded',
          },
        });
        return;
      } else if (e.message === 'ackNeeded') {
        commands.push({
          ids: [device.id],
          status: 'ERROR',
          errorCode: 'challengeNeeded',
          challengeNeeded: {
            type: 'ackNeeded',
          },
        });
        return;
      } else if (e.message === 'PENDING') {
        commands.push({
          ids: [device.id],
          status: 'PENDING',
        });
        return;
      }
      commands.push({
        ids: [device.id],
        status: 'ERROR',
        errorCode: e.message,
      });
    }
  });

  if (successCommand.ids.length) {
    commands.push(successCommand);
  }

  return {
    requestId: body.requestId,
    payload: {
      commands,
    },
  };
});

app.onDisconnect(async (body, headers) => {
  const userId = await getUserIdOrThrow(headers);
  await Firestore.disconnect(userId);
});

expressApp.post('/smarthome', app);

expressApp.post('/smarthome/update', async (req, res) => {
  console.log(req.body);
  const {
    userId,
    deviceId,
    name,
    nickname,
    states,
    localDeviceId,
    errorCode,
    tfa,
  } = req.body;
  try {
    await Firestore.updateDevice(
      userId,
      deviceId,
      name,
      nickname,
      states,
      localDeviceId,
      errorCode,
      tfa
    );
    if (localDeviceId || localDeviceId === null) {
      await app.requestSync(userId);
    }
    if (states !== undefined) {
      const res = await reportState(userId, deviceId, states);
      console.log('device state reported:', states, res);
    }
    res.status(200).send('OK');
  } catch (e) {
    console.error(e);
    res.status(400).send(`Error updating device: ${e}`);
  }
});

expressApp.post('/smarthome/create', async (req, res) => {
  console.log(req.body);
  const {userId, data} = req.body;
  try {
    await Firestore.addDevice(userId, data);
    await app.requestSync(userId);
  } catch (e) {
    console.error(e);
  } finally {
    res.status(200).send('OK');
  }
});

expressApp.post('/smarthome/delete', async (req, res) => {
  console.log(req.body);
  const {userId, deviceId} = req.body;
  try {
    await Firestore.deleteDevice(userId, deviceId);
    await app.requestSync(userId);
  } catch (e) {
    console.error(e);
  } finally {
    res.status(200).send('OK');
  }
});

const appPort = process.env.PORT || Config.expressPort;

const expressServer = expressApp.listen(appPort, async () => {
  const server = expressServer.address() as net.AddressInfo;
  const {address, port} = server;

  console.log(`Smart home server listening at ${address}:${port}`);

  if (Config.useNgrok) {
    try {
      const url = await ngrok.connect(Config.expressPort);
      console.log('');
      console.log('COPY & PASTE NGROK URL BELOW');
      console.log(url);
      console.log('');
      console.log('=====');
      console.log(
        'Visit the Actions on Google console at http://console.actions.google.com'
      );
      console.log('Replace the webhook URL in the Actions section with:');
      console.log('    ' + url + '/smarthome');

      console.log('');
      console.log('In the console, set the Authorization URL to:');
      console.log('    ' + url + '/fakeauth');

      console.log('');
      console.log('Then set the Token URL to:');
      console.log('    ' + url + '/faketoken');
      console.log('');

      console.log("Finally press the 'TEST DRAFT' button");
    } catch (err) {
      console.error('Ngrok was unable to start');
      console.error(err);
      throw err;
    }
  }
});
