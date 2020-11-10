/* Copyright 2018, Google, Inc.
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
 * Communicates with Firestore for a user's devices to control them or read
 * the current state.
 */
import {
  SmartHomeV1SyncDevices,
  SmartHomeV1ExecuteRequestExecution,
} from 'actions-on-google';
import {ApiClientObjectMap} from 'actions-on-google/dist/common';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();
const settings = {timestampsInSnapshots: true};
db.settings(settings);

export async function userExists(userId: string): Promise<boolean> {
  const userDoc = await db.collection('users').doc(userId).get();
  return userDoc.exists;
}

export async function getUserId(accessToken: string): Promise<string> {
  const querySnapshot = await db
    .collection('users')
    .where('fakeAccessToken', '==', accessToken)
    .get();
  if (querySnapshot.empty) {
    throw new Error('No user found for this access token');
  }
  const doc = querySnapshot.docs[0];
  return doc.id; // This is the user id in Firestore
}

export async function homegraphEnabled(userId: string): Promise<boolean> {
  const userDoc = await db.collection('users').doc(userId).get();
  return userDoc.data()!.homegraph;
}

export async function setHomegraphEnable(userId: string, enable: boolean) {
  await db.collection('users').doc(userId).update({
    homegraph: enable,
  });
}

export async function updateDevice(
  userId: string,
  deviceId: string,
  name: string,
  nickname: string,
  states: ApiClientObjectMap<string | boolean | number>,
  localDeviceId: string,
  errorCode: string,
  tfa: string
) {
  // Payload can contain any state data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: {[key: string]: any} = {};
  if (name) {
    updatePayload['name'] = name;
  }
  if (nickname) {
    updatePayload['nicknames'] = [nickname];
  }
  if (states) {
    updatePayload['states'] = states;
  }
  if (localDeviceId === null) {
    // null means local execution has been disabled.
    updatePayload['otherDeviceIds'] = admin.firestore.FieldValue.delete();
  } else if (localDeviceId !== undefined) {
    // undefined means localDeviceId was not updated.
    updatePayload['otherDeviceIds'] = [{deviceId: localDeviceId}];
  }
  if (errorCode) {
    updatePayload['errorCode'] = errorCode;
  } else if (!errorCode) {
    updatePayload['errorCode'] = '';
  }
  if (tfa) {
    updatePayload['tfa'] = tfa;
  } else if (tfa !== undefined) {
    updatePayload['tfa'] = '';
  }
  await db
    .collection('users')
    .doc(userId)
    .collection('devices')
    .doc(deviceId)
    .update(updatePayload);
}

export async function addDevice(
  userId: string,
  data: ApiClientObjectMap<string | boolean | number>
) {
  await db
    .collection('users')
    .doc(userId)
    .collection('devices')
    .doc(data.id as string)
    .set(data);
}

export async function deleteDevice(userId: string, deviceId: string) {
  await db
    .collection('users')
    .doc(userId)
    .collection('devices')
    .doc(deviceId)
    .delete();
}

export async function getDevices(
  userId: string
): Promise<SmartHomeV1SyncDevices[]> {
  const devices: SmartHomeV1SyncDevices[] = [];
  const querySnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('devices')
    .get();

  querySnapshot.forEach(doc => {
    const data = doc.data();
    const device: SmartHomeV1SyncDevices = {
      id: data.id,
      type: data.type,
      traits: data.traits,
      name: {
        defaultNames: data.defaultNames,
        name: data.name,
        nicknames: data.nicknames,
      },
      deviceInfo: {
        manufacturer: data.manufacturer,
        model: data.model,
        hwVersion: data.hwVersion,
        swVersion: data.swVersion,
      },
      willReportState: data.willReportState,
      attributes: data.attributes,
      otherDeviceIds: data.otherDeviceIds,
      customData: data.customData,
    };
    devices.push(device);
  });

  return devices;
}

export async function getState(
  userId: string,
  deviceId: string
): Promise<StatesMap> {
  const doc = await db
    .collection('users')
    .doc(userId)
    .collection('devices')
    .doc(deviceId)
    .get();

  if (!doc.exists) {
    throw new Error('deviceNotFound');
  }

  return doc.data()!.states;
}

// Payload can contain any state data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StatesMap = ApiClientObjectMap<any>;

export async function execute(
  userId: string,
  deviceId: string,
  execution: SmartHomeV1ExecuteRequestExecution
): Promise<StatesMap> {
  const doc = await db
    .collection('users')
    .doc(userId)
    .collection('devices')
    .doc(deviceId)
    .get();

  if (!doc.exists) {
    throw new Error('deviceNotFound');
  }

  const states: StatesMap = {
    online: true,
  };
  const data = doc.data();
  if (!data!.states.online) {
    throw new Error('deviceOffline');
  }
  if (data!.errorCode) {
    throw new Error(data!.errorCode);
  }
  if (data!.tfa === 'ack' && !execution.challenge) {
    throw new Error('ackNeeded');
  } else if (data!.tfa && !execution.challenge) {
    throw new Error('pinNeeded');
  } else if (data!.tfa && execution.challenge) {
    if (execution.challenge.pin && execution.challenge.pin !== data!.tfa) {
      throw new Error('challengeFailedPinNeeded');
    }
  }
  switch (execution.command) {
    // action.devices.traits.AppSelector
    case 'action.devices.commands.appSelect': {
      const {newApplication, newApplicationName} = execution.params!;
      const currentApplication = newApplication || newApplicationName;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.currentApplication': currentApplication,
        });
      states['currentApplication'] = currentApplication;
      break;
    }

    case 'action.devices.commands.appInstall': {
      const {newApplication, newApplicationName} = execution.params!;
      const currentApplication = newApplication || newApplicationName;
      console.log(`Install app ${currentApplication}`);
      break;
    }

    case 'action.devices.commands.appSearch': {
      const {newApplication, newApplicationName} = execution.params!;
      const currentApplication = newApplication || newApplicationName;
      console.log(`Search for app ${currentApplication}`);
      break;
    }

    // action.devices.traits.ArmDisarm
    case 'action.devices.commands.ArmDisarm': {
      const {arm, cancel, armLevel} = execution.params!;
      if (arm !== undefined) {
        states.isArmed = arm;
      } else if (cancel) {
        // Cancel value is in relation to the arm value
        states.isArmed = !data!.states.isArmed;
      }
      if (armLevel) {
        await db
          .collection('users')
          .doc(userId)
          .collection('devices')
          .doc(deviceId)
          .update({
            'states.isArmed': states.isArmed || data!.states.isArmed,
            'states.currentArmLevel': armLevel,
          });
        states['currentArmLevel'] = armLevel;
      } else {
        await db
          .collection('users')
          .doc(userId)
          .collection('devices')
          .doc(deviceId)
          .update({
            'states.isArmed': states.isArmed || data!.states.isArmed,
          });
      }
      break;
    }

    // action.devices.traits.Brightness
    case 'action.devices.commands.BrightnessAbsolute': {
      const {brightness} = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.brightness': brightness,
        });
      states['brightness'] = brightness;
      break;
    }

    // action.devices.traits.CameraStream
    case 'action.devices.commands.GetCameraStream': {
      states['cameraStreamAccessUrl'] = 'https://fluffysheep.com/baaaaa.mp4';
      break;
    }

    // action.devices.traits.ColorSetting
    case 'action.devices.commands.ColorAbsolute': {
      let color = {};
      if (execution.params!.color.spectrumRGB) {
        const {spectrumRGB} = execution.params!.color;
        await db
          .collection('users')
          .doc(userId)
          .collection('devices')
          .doc(deviceId)
          .update({
            'states.color': {
              spectrumRgb: spectrumRGB,
            },
          });
        color = {
          spectrumRgb: spectrumRGB,
        };
      } else if (execution.params!.color.spectrumHSV) {
        const {spectrumHSV} = execution.params!.color;
        await db
          .collection('users')
          .doc(userId)
          .collection('devices')
          .doc(deviceId)
          .update({
            'states.color': {
              spectrumHsv: spectrumHSV,
            },
          });
        color = {
          spectrumHsv: spectrumHSV,
        };
      } else if (execution.params!.color.temperature) {
        const {temperature} = execution.params!.color;
        await db
          .collection('users')
          .doc(userId)
          .collection('devices')
          .doc(deviceId)
          .update({
            'states.color': {
              temperatureK: temperature,
            },
          });
        color = {
          temperatureK: temperature,
        };
      } else {
        throw new Error('notSupported');
      }
      states['color'] = color;
      break;
    }

    // action.devices.traits.Cook
    case 'action.devices.commands.Cook': {
      if (execution.params!.start) {
        const {cookingMode, foodPreset, quantity, unit} = execution.params!;
        // Start cooking
        await db
          .collection('users')
          .doc(userId)
          .collection('devices')
          .doc(deviceId)
          .update({
            'states.currentCookingMode': cookingMode,
            'states.currentFoodPreset': foodPreset || 'NONE',
            'states.currentFoodQuantity': quantity || 0,
            'states.currentFoodUnit': unit || 'NO_UNITS',
          });
        states['currentCookingMode'] = cookingMode;
        states['currentFoodPreset'] = foodPreset;
        states['currentFoodQuantity'] = quantity;
        states['currentFoodUnit'] = unit;
      } else {
        // Done cooking, reset
        await db
          .collection('users')
          .doc(userId)
          .collection('devices')
          .doc(deviceId)
          .update({
            'states.currentCookingMode': 'NONE',
            'states.currentFoodPreset': 'NONE',
            'states.currentFoodQuantity': 0,
            'states.currentFoodUnit': 'NO_UNITS',
          });
        states['currentCookingMode'] = 'NONE';
        states['currentFoodPreset'] = 'NONE';
      }
      break;
    }

    // action.devices.traits.Dispense
    case 'action.devices.commands.Dispense': {
      let {amount, unit} = execution.params!;
      const {item, presetName} = execution.params!;
      if (presetName === 'cat food bowl') {
        // Fill in params
        amount = 4;
        unit = 'CUPS';
      }
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.dispenseItems': [
            {
              itemName: item,
              amountLastDispensed: {
                amount,
                unit,
              },
              isCurrentlyDispensing: presetName !== undefined,
            },
          ],
        });
      states['dispenseItems'] = [
        {
          itemName: item,
          amountLastDispensed: {
            amount,
            unit,
          },
          isCurrentlyDispensing: presetName !== undefined,
        },
      ];
      break;
    }

    // action.devices.traits.Dock
    case 'action.devices.commands.Dock': {
      // This has no parameters
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.isDocked': true,
        });
      states['isDocked'] = true;
      break;
    }

    // action.devices.traits.EnergyStorage
    case 'action.devices.commands.Charge': {
      const {charge} = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.isCharging': charge,
        });
      states['isCharging'] = charge;
      break;
    }

    // action.devices.traits.FanSpeed
    case 'action.devices.commands.SetFanSpeed': {
      const {fanSpeed} = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.currentFanSpeedSetting': fanSpeed,
        });
      states['currentFanSpeedSetting'] = fanSpeed;
      break;
    }

    case 'action.devices.commands.Reverse': {
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.currentFanSpeedReverse': true,
        });
      break;
    }

    // action.devices.traits.Fill
    case 'action.devices.commands.Fill': {
      const {fill, fillLevel} = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.isFilled': fill,
          'states.currentFillLevel': fill ? fillLevel || 'half' : 'none',
        });
      states['isFilled'] = fill;
      states['currentFillLevel'] = fill ? fillLevel || 'half' : 'none';
      break;
    }

    // action.devices.traits.HumiditySetting
    case 'action.devices.commands.SetHumidity': {
      const {humidity} = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.humiditySetpointPercent': humidity,
        });
      states['humiditySetpointPercent'] = humidity;
      break;
    }

    // action.devices.traits.InputSelector
    case 'action.devices.commands.SetInput': {
      const {newInput} = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.currentInput': newInput,
        });
      states['currentInput'] = newInput;
      break;
    }

    case 'action.devices.commands.PreviousInput': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const {availableInputs}: {availableInputs: any[]} = data!.attributes;
      const {currentInput} = data!.states;
      const currentInputIndex = availableInputs.findIndex(
        input => input.key === currentInput
      );
      const previousInputIndex = Math.min(currentInputIndex - 1, 0);
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.currentInput': availableInputs[previousInputIndex].key,
        });
      states['currentInput'] = availableInputs[previousInputIndex].key;
      break;
    }

    case 'action.devices.commands.NextInput': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const {availableInputs}: {availableInputs: any[]} = data!.attributes;
      const {currentInput} = data!.states;
      const currentInputIndex = availableInputs.findIndex(
        input => input.key === currentInput
      );
      const nextInputIndex = Math.max(
        currentInputIndex + 1,
        availableInputs.length - 1
      );
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.currentInput': availableInputs[nextInputIndex].key,
        });
      states['currentInput'] = availableInputs[nextInputIndex].key;
      break;
    }

    // action.devices.traits.Locator
    case 'action.devices.commands.Locate': {
      const {silent} = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.silent': silent,
          'states.generatedAlert': true,
        });
      states['generatedAlert'] = true;
      break;
    }

    // action.devices.traits.LockUnlock
    case 'action.devices.commands.LockUnlock': {
      const {lock} = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.isLocked': lock,
        });
      states['isLocked'] = lock;
      break;
    }

    // action.devices.traits.Modes
    case 'action.devices.commands.SetModes': {
      const {updateModeSettings} = execution.params!;
      const currentModeSettings: {
        [key: string]: string;
      } = data!.states.currentModeSettings;

      for (const mode of Object.keys(updateModeSettings)) {
        const setting = updateModeSettings[mode];
        currentModeSettings[mode] = setting;
      }
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.currentModeSettings': currentModeSettings,
        });
      states['currentModeSettings'] = currentModeSettings;
      break;
    }

    // action.devices.traits.NetworkControl
    case 'action.devices.commands.EnableDisableGuestNetwork': {
      const {enable} = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.guestNetworkEnabled': enable,
        });
      states['guestNetworkEnabled'] = enable;
      break;
    }

    case 'action.devices.commands.EnableDisableNetworkProfile': {
      const {profile} = execution.params!;
      if (!data!.attributes.networkProfiles.includes(profile)) {
        throw new Error('networkProfileNotRecognized');
      }
      // No state change occurs
      break;
    }

    case 'action.devices.commands.TestNetworkSpeed': {
      const {testDownloadSpeed, testUploadSpeed} = execution.params!;
      const {
        lastNetworkDownloadSpeedTest,
        lastNetworkUploadSpeedTest,
      } = data!.states;
      if (testDownloadSpeed) {
        // Randomly generate new download speed
        lastNetworkDownloadSpeedTest.downloadSpeedMbps = (
          Math.random() * 100
        ).toFixed(1); // To one degree of precision
        lastNetworkDownloadSpeedTest.unixTimestampSec = Math.floor(
          Date.now() / 1000
        );
      }
      if (testUploadSpeed) {
        // Randomly generate new upload speed
        lastNetworkUploadSpeedTest.uploadSpeedMbps = (
          Math.random() * 100
        ).toFixed(1); // To one degree of precision
        lastNetworkUploadSpeedTest.unixTimestampSec = Math.floor(
          Date.now() / 1000
        );
      }
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.lastNetworkDownloadSpeedTest': lastNetworkDownloadSpeedTest,
          'states.lastNetworkUploadSpeedTest': lastNetworkUploadSpeedTest,
        });
      // This operation is asynchronous and will be pending
      throw new Error('PENDING');
    }

    case 'action.devices.commands.GetGuestNetworkPassword': {
      states['guestNetworkPassword'] = 'wifi-password-123';
      break;
    }

    // action.devices.traits.OnOff
    case 'action.devices.commands.OnOff': {
      const {on} = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.on': on,
        });
      states['on'] = on;
      break;
    }

    // action.devices.traits.OpenClose
    case 'action.devices.commands.OpenClose': {
      // Check if the device can open in multiple directions
      if (data!.attributes && data!.attributes.openDirection) {
        // The device can open in more than one direction
        const {openDirection} = execution.params!;
        interface OpenState {
          openPercent: number;
          openDirection: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'IN' | 'OUT';
        }
        data!.states.openState.forEach((state: OpenState) => {
          if (state.openDirection === openDirection) {
            state.openPercent = execution.params!.openPercent;
          }
        });
        await db
          .collection('users')
          .doc(userId)
          .collection('devices')
          .doc(deviceId)
          .update({
            'states.openState': data!.states.openState,
          });
      } else {
        const {openPercent} = execution.params!;
        // The device can only open in one direction
        await db
          .collection('users')
          .doc(userId)
          .collection('devices')
          .doc(deviceId)
          .update({
            'states.openPercent': openPercent,
          });
        states['openPercent'] = openPercent;
      }
      break;
    }

    // action.devices.traits.Reboot
    case 'action.devices.commands.Reboot': {
      // When the device reboots, we can make it go offline until the frontend turns it back on
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.online': false,
        });
      // Reboot trait is stateless
      break;
    }

    // action.devices.traits.Rotation
    case 'action.devices.commands.RotateAbsolute': {
      const {rotationPercent, rotationDegrees} = execution.params!;
      if (rotationPercent) {
        await db
          .collection('users')
          .doc(userId)
          .collection('devices')
          .doc(deviceId)
          .update({
            'states.rotationPercent': rotationPercent,
          });
        states['rotationPercent'] = rotationPercent;
      } else if (rotationDegrees) {
        await db
          .collection('users')
          .doc(userId)
          .collection('devices')
          .doc(deviceId)
          .update({
            'states.rotationDegrees': rotationDegrees,
          });
        states['rotationDegrees'] = rotationDegrees;
      }
      break;
    }

    // action.devices.traits.RunCycle - No execution
    // action.devices.traits.Scene
    case 'action.devices.commands.ActivateScene': {
      const {deactivate} = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.deactivate': deactivate,
        });
      // Scenes are stateless
      break;
    }

    // action.devices.traits.SoftwareUpdate
    case 'action.devices.commands.SoftwareUpdate': {
      // When the device reboots, we can make it go offline until the frontend turns it back on
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.lastSoftwareUpdateUnixTimestampSec': Math.floor(
            new Date().getTime() / 1000
          ),
          'states.online': false,
        });
      // SoftwareUpdate trait is stateless
      break;
    }

    // action.devices.traits.StartStop
    case 'action.devices.commands.StartStop': {
      const {start} = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.isRunning': start,
        });
      states['isRunning'] = start;
      states['isPaused'] = data!.states.isPaused;
      break;
    }

    case 'action.devices.commands.PauseUnpause': {
      const {pause} = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.isPaused': pause,
        });
      states['isPaused'] = pause;
      states['isRunning'] = data!.states.isRunning;
      break;
    }

    // action.devices.traits.TemperatureControl
    case 'action.devices.commands.SetTemperature': {
      const {temperature} = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.temperatureSetpointCelsius': temperature,
        });
      states['temperatureSetpointCelsius'] = temperature;
      states[
        'temperatureAmbientCelsius'
      ] = data!.states.temperatureAmbientCelsius;
      break;
    }

    // action.devices.traits.TemperatureSetting
    case 'action.devices.commands.ThermostatTemperatureSetpoint': {
      const {thermostatTemperatureSetpoint} = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.thermostatTemperatureSetpoint': thermostatTemperatureSetpoint,
        });
      states['thermostatTemperatureSetpoint'] = thermostatTemperatureSetpoint;
      states['thermostatMode'] = data!.states.thermostatMode;
      states[
        'thermostatTemperatureAmbient'
      ] = data!.states.thermostatTemperatureAmbient;
      states[
        'thermostatHumidityAmbient'
      ] = data!.states.thermostatHumidityAmbient;
      break;
    }

    case 'action.devices.commands.ThermostatTemperatureSetRange': {
      const {
        thermostatTemperatureSetpointLow,
        thermostatTemperatureSetpointHigh,
      } = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.thermostatTemperatureSetpointLow': thermostatTemperatureSetpointLow,
          'states.thermostatTemperatureSetpointHigh': thermostatTemperatureSetpointHigh,
        });
      states[
        'thermostatTemperatureSetpoint'
      ] = data!.states.thermostatTemperatureSetpoint;
      states['thermostatMode'] = data!.states.thermostatMode;
      states[
        'thermostatTemperatureAmbient'
      ] = data!.states.thermostatTemperatureAmbient;
      states[
        'thermostatHumidityAmbient'
      ] = data!.states.thermostatHumidityAmbient;
      break;
    }

    case 'action.devices.commands.ThermostatSetMode': {
      const {thermostatMode} = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.thermostatMode': thermostatMode,
        });
      states['thermostatMode'] = thermostatMode;
      states[
        'thermostatTemperatureSetpoint'
      ] = data!.states.thermostatTemperatureSetpoint;
      states[
        'thermostatTemperatureAmbient'
      ] = data!.states.thermostatTemperatureAmbient;
      states[
        'thermostatHumidityAmbient'
      ] = data!.states.thermostatHumidityAmbient;
      break;
    }

    // action.devices.traits.Timer
    case 'action.devices.commands.TimerStart': {
      const {timerTimeSec} = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.timerRemainingSec': timerTimeSec,
        });
      states['timerRemainingSec'] = timerTimeSec;
      break;
    }

    case 'action.devices.commands.TimerAdjust': {
      if (data!.states.timerRemainingSec === -1) {
        // No timer exists
        throw new Error('noTimerExists');
      }
      const {timerTimeSec} = execution.params!;
      const newTimerRemainingSec =
        data!.states.timerRemainingSec + timerTimeSec;
      if (newTimerRemainingSec < 0) {
        throw new Error('valueOutOfRange');
      }
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.timerRemainingSec': newTimerRemainingSec,
        });
      states['timerRemainingSec'] = newTimerRemainingSec;
      break;
    }

    case 'action.devices.commands.TimerPause': {
      if (data!.states.timerRemainingSec === -1) {
        // No timer exists
        throw new Error('noTimerExists');
      }
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.timerPaused': true,
        });
      states['timerPaused'] = true;
      break;
    }

    case 'action.devices.commands.TimerResume': {
      if (data!.states.timerRemainingSec === -1) {
        // No timer exists
        throw new Error('noTimerExists');
      }
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.timerPaused': false,
        });
      states['timerPaused'] = false;
      break;
    }

    case 'action.devices.commands.TimerCancel': {
      if (data!.states.timerRemainingSec === -1) {
        // No timer exists
        throw new Error('noTimerExists');
      }
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.timerRemainingSec': -1,
        });
      states['timerRemainingSec'] = 0;
      break;
    }

    // action.devices.traits.Toggles
    case 'action.devices.commands.SetToggles': {
      const {updateToggleSettings} = execution.params!;
      const currentToggleSettings: {
        [key: string]: boolean;
      } = data!.states.currentToggleSettings;

      for (const toggle of Object.keys(updateToggleSettings)) {
        const enable = updateToggleSettings[toggle];
        currentToggleSettings[toggle] = enable;
      }
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.currentToggleSettings': currentToggleSettings,
        });
      states['currentToggleSettings'] = currentToggleSettings;
      break;
    }

    // action.devices.traits.TransportControl
    // Traits are considered no-ops as they have no state
    case 'action.devices.commands.mediaPrevious': {
      console.log('Play the previous media');
      break;
    }

    case 'action.devices.commands.mediaNext': {
      console.log('Play the next media');
      break;
    }

    case 'action.devices.commands.mediaRepeatMode': {
      const {isOn, isSingle} = execution.params!;
      console.log(
        `Repeat mode enabled: ${isOn}. Single item enabled: ${isSingle}`
      );
      break;
    }

    case 'action.devices.commands.mediaShuffle': {
      console.log('Shuffle the playlist of media');
      break;
    }

    case 'action.devices.commands.mediaClosedCaptioningOn': {
      const {closedCaptioningLanguage, userQueryLanguage} = execution.params!;
      console.log(
        `Closed captioning enabled for ${closedCaptioningLanguage} ` +
          `for user in ${userQueryLanguage}`
      );
      break;
    }

    case 'action.devices.commands.mediaClosedCaptioningOff': {
      console.log('Closed captioning disabled');
      break;
    }

    case 'action.devices.commands.mediaPause': {
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.playbackState': 'PAUSED',
        });
      states['playbackState'] = 'PAUSED';
      break;
    }

    case 'action.devices.commands.mediaResume': {
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.playbackState': 'PLAYING',
        });
      states['playbackState'] = 'PLAYING';
      break;
    }

    case 'action.devices.commands.mediaStop': {
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.playbackState': 'STOPPED',
        });
      states['playbackState'] = 'STOPPED';
      break;
    }

    // Traits are considered no-ops as they have no state
    case 'action.devices.commands.mediaSeekRelative': {
      const {relativePositionMs} = execution.params!;
      console.log(`Seek to (now + ${relativePositionMs}) ms`);
      break;
    }

    case 'action.devices.commands.mediaSeekToPosition': {
      const {absPositionMs} = execution.params!;
      console.log(`Seek to ${absPositionMs} ms`);
      break;
    }

    // action.devices.traits.Volume
    case 'action.devices.commands.setVolume': {
      const {volumeLevel} = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.currentVolume': volumeLevel,
        });
      states['currentVolume'] = volumeLevel;
      break;
    }

    case 'action.devices.commands.volumeRelative': {
      const {relativeSteps} = execution.params!;
      const {currentVolume} = data!.states;
      const newVolume = currentVolume + relativeSteps;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.currentVolume': newVolume,
        });
      states['currentVolume'] = newVolume;
      break;
    }

    case 'action.devices.commands.mute': {
      const {mute} = execution.params!;
      await db
        .collection('users')
        .doc(userId)
        .collection('devices')
        .doc(deviceId)
        .update({
          'states.isMuted': mute,
        });
      states['isMuted'] = mute;
      break;
    }

    default:
      throw new Error('actionNotAvailable');
  }

  return states;
}

export async function disconnect(userId: string) {
  await setHomegraphEnable(userId, false);
}
