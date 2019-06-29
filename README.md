# Actions on Google: Smart Home sample using Node.js

This sample contains a fully functioning example of a Smart Home provider
cloud service designed to work with Actions on Google. This can be used with a
Actions Console project to create an Action interface to your IoT devices.
This sample includes everything you need to get started, including a mocked
user authentication service with sample users and a user web portal to
demonstrate the user experience when controlling their lights with your action.

An example of a Smart Home IoT cloud engine is written here. This project can be
integrated with a web potral for an interactive experience.

## Setup Instructions

See the developer guide and release notes at [https://developers.google.com/actions/](https://developers.google.com/actions/) for more details.

Clone the project and the included frontend as a subdirectory:

```
git clone https://github.com/actions-on-google/smart-home-nodejs.git
cd smart-home-nodejs
git clone https://github.com/actions-on-google/smart-home-frontend.git
```

## Steps for testing with Google Assistant

### Create and set up project in Actions Console

1. Use the [Actions on Google Console](https://console.actions.google.com) to add a new project with a name of your choosing and click *Create Project*.
1. Select *Home Control*, then click *Smart Home*.

### Optional: Customize your action

1. From the top menu under *Develop*, click on *Invocation*.
1. Add your App's name. Click *Save*.
1. From the top menu under *DEPLOY*, click on *Directory Information*.
1. Add your App info, including images, a contact email and privacy policy. This information can all be edited before submitting for review.
1. Click *Save*.

### Add Request Sync and Report State
The Request Sync feature allows a cloud integration to send a request to the Home Graph
to send a new SYNC request. The Report State feature allows a cloud integration to proactively
provide the current state of devices to the Home Graph without a `QUERY` request. These are
done securely through [JWT (JSON web tokens)](https://jwt.io/).

1. Navigate to the
[Google Cloud Console API Manager](https://console.developers.google.com/apis)
for your project id.
1. Enable the [HomeGraph API](https://console.cloud.google.com/apis/api/homegraph.googleapis.com/overview).
1. Navigate to the [Google Cloud Console API & Services page](https://console.cloud.google.com/apis/credentials)
1. Select **Create Credentials** and create a **Service account key**
    1. Create a new Service account
    1. Use the role Service Account > Service Account Token Creator
1. Create the account and download a JSON file.
   Save this as `src/smart-home-key.json`.

### Connect to Firebase

1. Open your project in the Firebase console, and configure a Cloud Firestore database.
1. Configure a `users` collection with a default user and a few default fields

```
    users\
        1234
            fakeAccessToken: "123access"
            fakeRefreshToken: "123refresh"
            homegraph: false
```

1. Update the `googleCloudProjectId` field in `src/config.provider.ts` with your project ID.
1. Install Firebase tools by running `npm install -g firebase-tools`
1. Run `firebase use --add <project-id>`

**Note**: If you are not using Google App Engine to host your server, but still want to
integrate with Firestore, read [this guide](https://firebase.google.com/docs/admin/setup) on
setting up the Firebase Admin SDK.

### Deploy server to App Engine

1. Run `npm install`
1. Run `npm run build`

You can deploy directly to [Google App Engine](https://cloud.google.com/appengine/) by running
`npm run deploy`. If you do, you will first need the [gcloud CLI](https://cloud.google.com/sdk/docs/#install_the_latest_cloud_tools_version_cloudsdk_current_version).

### Running the sample locally
You can run the sample locally using ngrok, with a few modifications:

1. Navigate to the [Google Cloud Console API & Services page](https://console.cloud.google.com/apis/credentials)
1. Select **Create Credentials** and create a **Service account key**.
    1. Create a new Service account.
    1. Use the role **Firebase > Firebase Admin SDK Administrator Service Agent**.
1. Create the account and download the JSON file that the console generated for you.
   Save this as `src/firebase-admin-key.json`.
1. Modify the initialization code at [`src/firestore.ts`](https://github.com/actions-on-google/smart-home-nodejs/blob/master/src/firestore.ts).

```
const serviceAccount = require('./firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: https://${googleCloudProjectId}.firebaseio.com,
})
```

1. Run `npm run build`.
1. Run `npm run start:local`. This should print a URL in the format `https://{random-id}.ngrok.io`
1. Edit [`frontend/index.html`](https://github.com/actions-on-google/smart-home-frontend/blob/master/index.html) to update the `API_ENDPOINT` constant to this URL.

### Setup sample service

1. Set up the web portal

```
cd frontend
npm install
npm run create-firebase-config
npm run serve
```

1. Open the web portal URL.
1. Configure the virtual devices
shown as you please. Click the cloud icon shown above at least one of them to
enable it for cloud control.

### Start testing

1. Navigate back to the [Actions on Google Console](https://console.actions.google.com).
1. From the top menu under *Develop*, click on *Actions* (left nav). Click on *Add your first action* and choose your app's language(s).
1. Enter the URL for fulfillment and click *Done*.
    1. If using Ngrok, the URL will be printed in the console, https://{random-id}.ngrok.io/smarthome
    1. If using Google App Engine, the URL will be https://{project-id}.appspot.com/smarthome
1. On the left navigation menu under *ADVANCED OPTIONS*, click on *Account Linking*.
    1. Select *No, I only want to allow account creation on my website*. Click *Next*.
    1. For Linking Type, select *OAuth*.
    1. For Grant Type, select 'Authorization Code' for Grant Type.
    1. Under Client Information, enter the client ID and secret as defined `src/config-provider.ts`:
        * Client Id: `sampleClientId`
        * Client Secret: `sampleClientSecret`
1. The Authorization URL is the hosted URL of your app with '/fakeauth' as the
path
    1. If using Ngrok, the URL will be printed in the console, https://{random-id}.ngrok.io/fakeauth
    1. If using Google App Engine, the URL will be https://{project-id}.appspot.com/fakeauth
1. The Token URL is the hosted URL of your app with '/faketoken' as the path
    1. If using Ngrok, the URL will be printed in the console, https://{random-id}.ngrok.io/faketoken
    1. If using Google App Engine, the URL will be https://{project-id}.appspot.com/faketoken
1. Enter any remaining necessary information you might need for
authentication your app. Click *Save*.
1. On the left navigation menu under *Test*, click on *Simulator*, to begin testing this app.

### Set up Account linking

1. On a device with the Google Assistant logged into the same account used
to create the project in the Actions Console, enter your Assistant settings.
1. Click Home Control.
1. Click the '+' sign to add a device.
1. Find your app in the list of providers.
1. Log in to your service.
1. Start using the Google Assistant in the Actions Console to control your devices. Try saying 'turn my lights on'.

:information_source: Assistant will only provide you control over items that are registered, so if you visit your front end and click the add icon to create a device your server will receive a new SYNC command.

## References & Issues
+ Questions? Go to [StackOverflow](https://stackoverflow.com/questions/tagged/actions-on-google), [Assistant Developer Community on Reddit](https://www.reddit.com/r/GoogleAssistantDev/) or [Support](https://developers.google.com/actions/support/).
+ For bugs, please report an issue on Github.
+ Actions on Google [Documentation](https://developers.google.com/actions/extending-the-assistant)
+ Actions on Google [Codelabs](https://codelabs.developers.google.com/?cat=Assistant).
 
## Make Contributions
Please read and follow the steps in the [CONTRIBUTING.md](CONTRIBUTING.md).
 
## License
See [LICENSE](LICENSE).
 
## Terms
Your use of this sample is subject to, and by using or downloading the sample files you agree to comply with, the [Google APIs Terms of Service](https://developers.google.com/terms/).
