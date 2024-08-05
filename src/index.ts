import * as functions from 'firebase-functions';
import { WebhookClient } from 'dialogflow-fulfillment';
import twilio from 'twilio';
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID!; // TwilioのアカウントSID
const authToken = process.env.TWILIO_AUTH_TOKEN!; // Twilioの認証トークン
const client = twilio(accountSid, authToken);

const fromNumber = process.env.TWILIO_PHONE_NUMBER!; // 発信元のTwilio電話番号
const toNumber = process.env.TEST_PHONE_NUMBER!; // 発信先の電話番号（テスト用）

const makeCallHandler = (agent: WebhookClient) => {
  client.calls
    .create({
      url: 'http://demo.twilio.com/docs/voice.xml', // TwiMLのURL
      to: toNumber,
      from: fromNumber,
    })
    .then((call) => console.log(call.sid))
    .catch((error) => console.error(error));

  agent.add('発信しました。');
};

export const dialogflowWebhook = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response });

  const intentMap = new Map();
  intentMap.set('Make Call Intent', makeCallHandler); // 発信インテントをハンドラーに登録

  agent.handleRequest(intentMap);
});
