import * as functions from 'firebase-functions';
import { WebhookClient } from 'dialogflow-fulfillment';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import twilio from 'twilio';

const secretManager = new SecretManagerServiceClient();

async function getSecret(secretName: string): Promise<string> {
  const [version] = await secretManager.accessSecretVersion({
    name: `projects/304315430389/secrets/${secretName}/versions/latest`,
  });
  const value = version.payload!.data!.toString();
  if (!value) {
    throw new Error(`Secret ${secretName} is not set`);
  }
  return value;
}

async function initializeTwilioClient() {
  const accountSid = await getSecret('TWILIO_ACCOUNT_SID');
  const authToken = await getSecret('TWILIO_AUTH_TOKEN');
  return twilio(accountSid, authToken);
}

let twilioClient: any;

// 共通の通話発信ロジック
async function initiateCall() {
  if (!twilioClient) {
    twilioClient = await initializeTwilioClient();
  }
  const calling_functionsURL = await getSecret('CALLING_FUNCTIONS_URL');
  const fromNumber = await getSecret('TWILIO_PHONE_NUMBER');
  const toNumber = await getSecret('TEST_PHONE_NUMBER');

  return await twilioClient.calls.create({
  url: calling_functionsURL,
  to: toNumber,
  from: fromNumber,
  statusCallback: 'https://us-central1-health-check-app-431304.cloudfunctions.net/callStatusCallback',
  statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
});
}
//通話のステータスコールバック用の関数
export const callStatusCallback = functions.https.onRequest(async (req, res) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;

  console.log(`Call ${callSid} status changed to ${callStatus}`);

  // ここでステータス変更に応じた処理を行う
  // 例: データベースの更新、通知の送信など

  res.status(200).send('OK');
});

// Cloud Scheduler用の関数
export const scheduledCall = functions.https.onRequest(async (req, res) => {
  try {
    const call = await initiateCall();
    console.log(`Scheduled call initiated with SID: ${call.sid}`);
    res.status(200).send('Call initiated successfully');
  } catch (error) {
    console.error('Error initiating scheduled call:', error instanceof Error ? error.message : String(error));
    res.status(500).send('Error initiating call');
  }
});

// Dialogflow用の関数
export const dialogflowWebhook = functions.https.onRequest(async (request, response) => {
  try {
    const agent = new WebhookClient({ request, response });
    const intentMap = new Map();
    intentMap.set('Make Call Intent', makeCallHandler);
    await agent.handleRequest(intentMap);
  } catch (error) {
    console.error('Error in dialogflowWebhook:', error instanceof Error ? error.message : String(error));
    response.status(500).send('Error processing Dialogflow request');
  }
});

// Dialogflowの発信インテントハンドラー
const makeCallHandler = async (agent: WebhookClient) => {
  try {
    const call = await initiateCall();
    console.log(call.sid);
    agent.add('発信しました。');
  } catch (error) {
    console.error('Error in makeCallHandler:', error instanceof Error ? error.message : String(error));
    agent.add('発信に失敗しました。');
  }
};

// 将来的に他のAIチャットプラットフォーム用の関数を追加可能
// 例: Dify用の関数
// export const difyWebhook = functions.https.onRequest((req, res) => {
//   try {
//     // Dify特有の処理
//     // handleDifyRequest(req, res);
//   } catch (error) {
//     console.error('Error in difyWebhook:', error);
//     res.status(500).send('Error processing Dify request');
//   }
// });