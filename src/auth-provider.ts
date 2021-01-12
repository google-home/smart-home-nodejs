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
 * Dummy auth provider implementation.
 *
 * See:
 * https://developers.google.com/assistant/smarthome/develop/implement-oauth
 * for more details about implementing OAuth account linking.
 */
import util from 'util';

import {Headers} from 'actions-on-google';
import express from 'express';
import * as functions from 'firebase-functions';

import * as firestore from './firestore';

/**
 * A function that gets the user id from an access token.
 * Replace this functionality with your own OAuth provider.
 *
 * @param headers HTTP request headers
 * @return The user id
 */
export async function getUser(headers: Headers): Promise<string> {
  const authorization = headers.authorization;
  const accessToken = (authorization as string).substr(7);
  return await firestore.getUserId(accessToken);
}

const app = express();

app.get('/login', (req, res) => {
  res.send(`<html>
<body>
<form action="/login" method="post">
<input type="hidden" name="response_url" value="${req.query.response_url}" />
<button type="submit" style="font-size:14pt">Link this service to Google</button>
</form>
</body>
</html>
`);
});

app.post('/login', async (req, res) => {
  functions.logger.debug('/login', req.query);
  // Here, you should validate the user account.
  // In this sample, we do not do that.
  const responseUrl = decodeURIComponent(req.body.response_url as string);
  functions.logger.debug('redirect:', responseUrl);
  return res.redirect(responseUrl);
});

app.get('/fakeauth', async (req, res) => {
  functions.logger.debug('/fakeauth', req.query);
  const responseUrl = util.format(
    '%s?code=%s&state=%s',
    decodeURIComponent(req.query.redirect_uri as string),
    'xxxxxx',
    req.query.state
  );
  const redirectUrl = `/login?response_url=${encodeURIComponent(responseUrl)}`;
  functions.logger.debug('redirect:', redirectUrl);
  return res.redirect(redirectUrl);
});

app.all('/faketoken', async (req, res) => {
  functions.logger.debug('/faketoken', req.query);
  const grantType = req.query.grant_type
    ? req.query.grant_type
    : req.body.grant_type;
  const secondsInDay = 86400; // 60 * 60 * 24
  const HTTP_STATUS_OK = 200;
  let token;
  if (grantType === 'authorization_code') {
    token = {
      token_type: 'bearer',
      access_token: '123access',
      refresh_token: '123refresh',
      expires_in: secondsInDay,
    };
  } else if (grantType === 'refresh_token') {
    token = {
      token_type: 'bearer',
      access_token: '123access',
      expires_in: secondsInDay,
    };
  }
  functions.logger.debug('token:', token);
  res.status(HTTP_STATUS_OK).json(token);
});

export const authProvider = functions.https.onRequest(app);
