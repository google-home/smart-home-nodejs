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
import * as express from 'express'
import * as bodyParser from 'body-parser'
import * as cors from 'cors'
import * as morgan from 'morgan'
import * as ngrok from 'ngrok'
import { AddressInfo } from 'net'

// Smart home imports
import {
  smarthome,
  SmartHomeV1ExecuteResponseCommands,
  Headers,
} from 'actions-on-google'

// Local imports
import * as Firestore from './firestore'
import * as Auth from './auth-provider'
import * as Config from './config-provider'

const expressApp = express()
expressApp.use(cors())
expressApp.use(morgan('dev'))
expressApp.use(bodyParser.json())
expressApp.use(bodyParser.urlencoded({extended: true}))
expressApp.set('trust proxy', 1)

Auth.registerAuthEndpoints(expressApp)

let jwt
try {
  jwt = require('./smart-home-key.json')
} catch (e) {
  console.warn('Service account key is not found')
  console.warn('Report state and Request sync will be unavailable')
}

const app = smarthome({
  jwt,
  debug: true,
})

// Array could be of any type
// tslint:disable-next-line
async function asyncForEach(array: any[], callback: Function) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array)
  }
}

async function getUserIdOrThrow(headers: Headers): Promise<string> {
  const userId = await Auth.getUser(headers)
  const userExists = await Firestore.userExists(userId)
  if (!userExists) {
    throw new Error(`User ${userId} has not created an account, so there are no devices`)
  }
  return userId
}

app.onSync(async (body, headers) => {
  const userId = await getUserIdOrThrow(headers)
  await Firestore.setHomegraphEnable(userId, true)

  const devices = await Firestore.getDevices(userId)
  return {
    requestId: body.requestId,
    payload: {
      agentUserId: userId,
      devices,
    },
  }
})

interface DeviceStatesMap {
  // tslint:disable-next-line
  [key: string]: any
}
app.onQuery(async (body, headers) => {
  const userId = await getUserIdOrThrow(headers)
  const deviceStates: DeviceStatesMap = {}
  const {devices} = body.inputs[0].payload
  await asyncForEach(devices, async (device: {id: string}) => {
    const states = await Firestore.getState(userId, device.id)
    deviceStates[device.id] = states
  })
  return {
    requestId: body.requestId,
    payload: {
      devices: deviceStates,
    },
  }
})

app.onExecute(async (body, headers) => {
  const userId = await getUserIdOrThrow(headers)
  const commands: SmartHomeV1ExecuteResponseCommands[] = [{
    ids: [],
    status: 'SUCCESS',
    states: {},
  }]

  const {devices, execution} = body.inputs[0].payload.commands[0]
  await asyncForEach(devices, async (device: {id: string}) => {
    try {
      const states = await Firestore.execute(userId, device.id, execution[0])
      commands[0].ids.push(device.id)
      commands[0].states = states

      // Report state back to Homegraph
      await app.reportState({
        agentUserId: userId,
        requestId: Math.random().toString(),
        payload: {
          devices: {
            states: {
              [device.id]: states,
            },
          },
        },
      })
    } catch (e) {
      commands.push({
        ids: [device.id],
        status: 'ERROR',
        errorCode: e.message,
      })
    }
  })

  return {
    requestId: body.requestId,
    payload: {
      commands,
    },
  }
})

app.onDisconnect(async (body, headers) => {
  const userId = await getUserIdOrThrow(headers)
  await Firestore.disconnect(userId)
})

expressApp.post('/smarthome', app)

expressApp.post('/smarthome/update', async (req, res) => {
  console.log(req.body)
  const {userId, deviceId, name, nickname, states} = req.body
  try {
    await Firestore.updateDevice(userId, deviceId, name, nickname, states)
    const reportStateResponse = await app.reportState({
      agentUserId: userId,
      requestId: Math.random().toString(),
      payload: {
        devices: {
          states: {
            [deviceId]: states,
          },
        },
      },
    })
    console.log(reportStateResponse)
    res.status(200).send('OK')
  } catch(e) {
    console.error(e)
    res.status(400).send(`Error reporting state: ${e}`)
  }
})

expressApp.post('/smarthome/create', async (req, res) => {
  console.log(req.body)
  const {userId, data} = req.body
  try {
    await Firestore.addDevice(userId, data)
    await app.requestSync(userId)
  } catch(e) {
    console.error(e)
  } finally {
    res.status(200).send('OK')
  }
})

expressApp.post('/smarthome/delete', async (req, res) => {
  console.log(req.body)
  const {userId, deviceId} = req.body
  try {
    await Firestore.deleteDevice(userId, deviceId)
    await app.requestSync(userId)
  } catch(e) {
    console.error(e)
  } finally {
    res.status(200).send('OK')
  }
})

const appPort = process.env.PORT || Config.expressPort

const expressServer = expressApp.listen(appPort, () => {
  const server = expressServer.address() as AddressInfo
  const {address, port} = server

  console.log(`Smart home server listening at ${address}:${port}`)

  if (Config.useNgrok) {
    ngrok.connect(Config.expressPort, (err, url) => {
      if (err) {
        console.error('Ngrok was unable to start')
        console.error(err)
        process.exit()
      }

      console.log('')
      console.log('COPY & PASTE NGROK URL BELOW')
      console.log(url)
      console.log('')
      console.log('=====')
      console.log('Visit the Actions on Google console at http://console.actions.google.com')
      console.log('Replace the webhook URL in the Actions section with:')
      console.log('    ' + url + '/smarthome')

      console.log('')
      console.log('In the console, set the Authorization URL to:')
      console.log('    ' + url + '/fakeauth')

      console.log('')
      console.log('Then set the Token URL to:')
      console.log('    ' + url + '/faketoken')
      console.log('')

      console.log('Finally press the \'TEST DRAFT\' button')
    })
  }
})
