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

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import morgan from 'morgan';
import ngrok from 'ngrok';
import net from 'net';

import * as configProvider from './config-provider';
import authProvider from './auth-provider';
import deviceManager from './device-manager';
import fulfillment from './fulfillment';

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.set('trust proxy', 1);
app.use(authProvider);
app.use(fulfillment);
app.use(deviceManager);

const appPort = process.env.PORT || configProvider.expressPort;

const server = app.listen(appPort, async () => {
  const {address, port} = server.address() as net.AddressInfo;

  console.log(`Smart home server listening at ${address}:${port}`);

  if (configProvider.useNgrok) {
    try {
      const url = await ngrok.connect(configProvider.expressPort);
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
