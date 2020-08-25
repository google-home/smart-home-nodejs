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
  * This provides a number of parameters that may be used throughout this sample.
  */

// Port used for Express server
export const expressPort = 3000

// Client id that Google will use to make authorized requests
// In a production environment you should change this value
export const googleClientId = 'sampleClientId'

// Client secret that Google will use to make authorized requests
// In a production environment you should change this value
export const googleClientSecret = 'sampleClientSecret'

let ngrok = false
process.argv.forEach((value) => {
  if (value.includes('isLocal')) {
    ngrok = true
  }
})

// Running server locally using ngrok
export const useNgrok = ngrok

export const googleCloudProjectId = 'insert-your-project-id'
