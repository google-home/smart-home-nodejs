/* Copyright 2020, Google, Inc.
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
 * https://developers.google.com/assistant/smarthome/develop/process-intents
 */
import fs from 'fs';
import path from 'path';

import {
  smarthome,
  SmartHomeV1ExecuteResponseCommands,
  Headers,
} from 'actions-on-google';
import * as functions from 'firebase-functions';

import {getUser} from './auth-provider';
import * as firestore from './firestore';

let jwt;
try {
  jwt = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'smart-home-key.json')).toString()
  );
} catch (e) {
  console.warn('Service account key is not found');
  console.warn('Report state and Request sync will be unavailable');
}

export const app = smarthome({
  jwt,
});

// Array could be of any type
async function asyncForEach<T>(array: T[], callback: Function) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

async function getUserIdOrThrow(headers: Headers): Promise<string> {
  const userId = await getUser(headers);
  const userExists = await firestore.userExists(userId);
  if (!userExists) {
    throw new Error(
      `User ${userId} has not created an account, so there are no devices`
    );
  }
  return userId;
}

app.onSync(async (body, headers) => {
  const userId = await getUserIdOrThrow(headers);
  await firestore.setHomegraphEnable(userId, true);

  const devices = await firestore.getDevices(userId);
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
      const states = await firestore.getState(userId, device.id);
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

  const {devices, execution} = body.inputs[0].payload.commands[0];
  await asyncForEach(devices, async (device: {id: string}) => {
    try {
      const states = await firestore.execute(userId, device.id, execution[0]);
      commands.push({
        ids: [device.id],
        status: 'SUCCESS',
        states,
      });
      const res = await app.reportState({
        agentUserId: userId,
        requestId: Math.random().toString(),
        payload: {
          devices: {
            states: {
              [device.id]: states,
            },
          },
        },
      });
      console.log('device state reported:', states, res);
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

  return {
    requestId: body.requestId,
    payload: {
      commands,
    },
  };
});

app.onDisconnect(async (body, headers) => {
  const userId = await getUserIdOrThrow(headers);
  await firestore.disconnect(userId);
});

export const fulfillment = functions.https.onRequest(app);
