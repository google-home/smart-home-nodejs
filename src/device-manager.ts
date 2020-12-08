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
import * as functions from 'firebase-functions';
import express from 'express';

import * as firestore from './firestore';
import {app as smarthome} from './fulfillment';

const app = express();

app.post('/smarthome/update', async (req, res) => {
  functions.logger.debug('/smarthome/update', req.body);
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
  } catch (e) {
    functions.logger.error('error updating firestore device document:', e);
    return res.status(400).send({
      firestoreError: e.message,
    });
  }

  if (localDeviceId || localDeviceId === null) {
    try {
      functions.logger.debug('RequestSyncRequest:', userId);
      const requestSyncResponse = JSON.parse(
        await smarthome.requestSync(userId)
      );
      functions.logger.debug('RequestSyncResponse:', requestSyncResponse);
    } catch (e) {
      const errorResponse = JSON.parse(e);
      functions.logger.error(
        'error requesting sync to homegraph:',
        errorResponse
      );
      return res.status(500).send({
        requestSyncError: errorResponse.error.message,
      });
    }
  }

  if (states !== undefined) {
    try {
      const reportStateRequest = {
        agentUserId: userId,
        requestId: Math.random().toString(),
        payload: {
          devices: {
            states: {
              [deviceId]: states,
            },
          },
        },
      };
      functions.logger.debug('RequestStateRequest:', reportStateRequest);
      const reportStateResponse = JSON.parse(
        await smarthome.reportState(reportStateRequest)
      );
      functions.logger.debug('ReportStateResponse:', reportStateResponse);
    } catch (e) {
      const errorResponse = JSON.parse(e);
      functions.logger.error(
        'error reporting device state to homegraph:',
        errorResponse
      );
      return res.status(500).send({
        reportStateError: errorResponse.error.message,
      });
    }
  }
  return res.status(200).end();
});

app.post('/smarthome/create', async (req, res) => {
  functions.logger.debug('/smarthome/create', req.body);
  const {userId, data} = req.body;
  try {
    await firestore.addDevice(userId, data);
  } catch (e) {
    functions.logger.error('error adding firestore device document:', e);
    return res.status(400).send({
      firestoreError: e.message,
    });
  }
  try {
    functions.logger.debug('RequestSyncRequest:', userId);
    const requestSyncResponse = JSON.parse(await smarthome.requestSync(userId));
    functions.logger.debug('RequestSyncResponse:', requestSyncResponse);
  } catch (e) {
    const errorResponse = JSON.parse(e);
    functions.logger.error(
      'error requesting sync to homegraph:',
      errorResponse
    );
    return res.status(500).send({
      requestSync: errorResponse.error.message,
    });
  }
  return res.status(201).end();
});

app.post('/smarthome/delete', async (req, res) => {
  functions.logger.debug('/smarthome/delete', req.body);
  const {userId, deviceId} = req.body;
  try {
    await firestore.deleteDevice(userId, deviceId);
  } catch (e) {
    functions.logger.error('error adding firestore device document:', e);
    return res.status(400).send({
      firestoreError: e.message,
    });
  }
  try {
    functions.logger.debug('RequestSyncRequest:', userId);
    const requestSyncResponse = JSON.parse(await smarthome.requestSync(userId));
    functions.logger.debug('RequestSyncResponse:', requestSyncResponse);
  } catch (e) {
    const errorResponse = JSON.parse(e);
    functions.logger.error(
      'error requesting sync to homegraph:',
      errorResponse
    );
    return res.status(500).send({
      requestSync: errorResponse.error.message,
    });
  }
  return res.status(204).end();
});

export const deviceManager = functions.https.onRequest(app);
