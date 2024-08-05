import * as functions from 'firebase-functions';
import { WebhookClient } from 'dialogflow-fulfillment';
import twilio from 'twilio';
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const client = twilio(accountSid, authToken);

const calling_functionsURL = process.env.CALLING_FUNCTIONS_URL!;
const fromNumber = process.env.TWILIO_PHONE_NUMBER!;
const toNumber = process.env.TEST_PHONE_NUMBER!;

// 共通の通話発信ロジック
async function initiateCall() {
  return await client.calls.create({
    url: calling_functionsURL,
    to: toNumber,
    from: fromNumber,
  });
}

// Cloud Scheduler用の関数
export const scheduledCall = functions.https.onRequest(async (req, res) => {
  try {
    const call = await initiateCall();
    console.log(`Scheduled call initiated with SID: ${call.sid}`);
    res.status(200).send('Call initiated successfully');
  } catch (error) {
    console.error('Error initiating scheduled call:', error);
    res.status(500).send('Error initiating call');
  }
});

// Dialogflow用の関数
export const dialogflowWebhook = functions.https.onRequest((request, response) => {
  try {
    const agent = new WebhookClient({ request, response });
    const intentMap = new Map();
    intentMap.set('Make Call Intent', makeCallHandler);
    agent.handleRequest(intentMap);
  } catch (error) {
    console.error('Error in dialogflowWebhook:', error);
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
    console.error('Error in makeCallHandler:', error);
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