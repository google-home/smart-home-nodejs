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
 * device-manager implements a CRUD endpoint for managing smarthome devices.
 */
import express from 'express';

import * as firestore from './firestore';
import smarthome from './fulfillment';

const app = express();

app.post('/smarthome/update', async (req, res) => {
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
    await firestore.updateDevice(
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
      await smarthome.requestSync(userId);
    }
    if (states !== undefined) {
      const res = await smarthome.reportState({
        agentUserId: userId,
        requestId: Math.random().toString(),
        payload: {
          devices: {
            states: {
              [deviceId]: states,
            },
          },
        },
      });
      console.log('device state reported:', states, res);
    }
    res.status(200).send('OK');
  } catch (e) {
    console.error(e);
    res.status(400).send(`Error updating device: ${e}`);
  }
});

app.post('/smarthome/create', async (req, res) => {
  console.log(req.body);
  const {userId, data} = req.body;
  try {
    await firestore.addDevice(userId, data);
    await smarthome.requestSync(userId);
  } catch (e) {
    console.error(e);
  } finally {
    res.status(200).send('OK');
  }
});

app.post('/smarthome/delete', async (req, res) => {
  console.log(req.body);
  const {userId, deviceId} = req.body;
  try {
    await firestore.deleteDevice(userId, deviceId);
    await smarthome.requestSync(userId);
  } catch (e) {
    console.error(e);
  } finally {
    res.status(200).send('OK');
  }
});

export default app;
