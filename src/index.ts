import * as functions from 'firebase-functions';
import { WebhookClient } from 'dialogflow-fulfillment';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import twilio from 'twilio';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { Storage } from '@google-cloud/storage';
import { SpeechClient } from '@google-cloud/speech';
import { v4 as uuidv4 } from 'uuid';
import * as dialogflow from '@google-cloud/dialogflow';

const secretManager = new SecretManagerServiceClient();
const textToSpeechClient = new TextToSpeechClient();
const storage = new Storage();

// 環境変数から取得
const projectId = process.env.GCLOUD_PROJECT;
const storageBucketName = process.env.STORAGE_BUCKET;

async function getSecret(secretName: string): Promise<string> {
  try {
    const [version] = await secretManager.accessSecretVersion({
      name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
    });
    const value = version.payload?.data?.toString();
    if (!value) {
      throw new Error(`Secret ${secretName} is not set or empty`);
    }
    return value;
  } catch (error) {
    console.error(`Error accessing secret ${secretName}:`, error);
    throw error; // エラーを呼び出し元に伝播
  }
}

// Twilio クライアントの初期化
async function initializeTwilioClient(): Promise<twilio.Twilio> {
  const accountSid = await getSecret('TWILIO_ACCOUNT_SID');
  const authToken = await getSecret('TWILIO_AUTH_TOKEN');
  return twilio(accountSid, authToken);
}

// 共通の通話発信ロジック
async function initiateCall(): Promise<any> {
  const client = await initializeTwilioClient();
  const callingFunctionsUrl = await getSecret('CALLING_FUNCTIONS_URL');
  const fromNumber = await getSecret('TWILIO_PHONE_NUMBER');
  const toNumber = await getSecret('TEST_PHONE_NUMBER');

  return await client.calls.create({
    url: callingFunctionsUrl,
    to: toNumber,
    from: fromNumber,
    statusCallback: 'https://us-central1-health-check-app-431304.cloudfunctions.net/main',
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
  });
}

// 通話のステータスコールバック
export const callStatusCallback = functions.https.onRequest((req, res) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  console.log(`Call ${callSid} status changed to ${callStatus}`);
  // ステータス変更に応じた処理 (データベース更新、通知など)
  res.status(200).send('OK');
});

// Cloud Scheduler 用の関数
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

// 音声合成
async function synthesizeSpeech(text: string, outputFileName: string): Promise<string> {
  try {
    const [response] = await textToSpeechClient.synthesizeSpeech({
      input: { text },
      voice: { languageCode: 'ja-JP', name: 'ja-JP-Wavenet-C' },
      audioConfig: { audioEncoding: 'MP3' },
    });

    const audioContent = response.audioContent;

    if (!audioContent) {
      throw new Error('No audio content returned from Text-to-Speech API');
    }

    await saveAudioToStorage(Buffer.from(audioContent), outputFileName);
    return `https://storage.googleapis.com/${storageBucketName}/${outputFileName}`;
  } catch (error) {
    console.error('Error synthesizing speech:', error);
    // エラーが発生した場合のフォールバック処理（例：デフォルトのメッセージを返す）
    return `https://storage.googleapis.com/${storageBucketName}/error_message.mp3`;
  }
}

// Cloud Storage への保存
async function saveAudioToStorage(audioContent: Buffer, outputFileName: string): Promise<void> {
  try {
    if (!storageBucketName) {
      throw new Error('Storage bucket name is undefined');
    }
    const file = storage.bucket(storageBucketName).file(outputFileName);
    await file.save(audioContent);
  } catch (error) {
    console.error('Error saving audio to storage:', error);
    throw error; // エラーを呼び出し元に伝播
  }
}

// Dialogflow CX Webhook
export const dialogflowWebhook = functions.https.onRequest(async (request, response) => {
  const agent = new WebhookClient({ request, response });

  const intentMap = new Map();
  intentMap.set('Make Call Intent', makeCallHandler);
  await agent.handleRequest(intentMap);

  const intent = agent.intent;
  const sessionPath = agent.session.split('/').slice(-1)[0];

  // セッションごとのタイムアウト管理
  const sessionTimeout = 5000; // 5秒
  const sessionTimeouts = new Map<string, NodeJS.Timeout>();
  let noInputCount = 0;

  function handleNoInput() {
    noInputCount++;
    if (noInputCount < 2) { // 2回「もしもし？」と聞く
      agent.add('もしもし？');
      resetTimeout(sessionPath);
    } else {
      agent.setFollowupEvent('interruption.intent'); // interruption.intent に遷移
      response.json(agent);
    }
  }

  function resetTimeout(sessionId: string) {
    clearTimeout(sessionTimeouts.get(sessionId));
    const timeoutId = setTimeout(handleNoInput, sessionTimeout);
    sessionTimeouts.set(sessionId, timeoutId);
  }

  // 初期タイムアウト設定
  resetTimeout(sessionPath);

  // インテントに応じた処理
  switch (intent) {
    case 'user.name':
      const userName = agent.parameters.name;
      // Firestore などに名前を保存する処理 (agent.add() は不要)
      break;
    case 'health.check':
      const healthStatus = agent.parameters['health-status'];
      // Firestore などに健康状態を保存する処理 (agent.add() は不要)
      break;
    case 'schedule.check':
      const plan = agent.parameters.plan;
      const dateTime = agent.parameters['date-time'];
      // Firestore などに予定を保存する処理 (agent.add() は不要)
      break;
    case 'interruption.intent':
    case 'cancel.intent':
      agent.add('失礼しました！また改めます！');
      break;
    default:
      agent.add('すみません、聞き取れなかったのでもう一度お願いします。');
      resetTimeout(sessionPath); 
  }

  // セッション終了時の処理
  response.json(agent); 
});
async function handleDialogflowResponse(dialogflowResponse: any, twiml: any) {
  const intent = dialogflowResponse.queryResult.intent.displayName;
  const fulfillmentMessages = dialogflowResponse.queryResult.fulfillmentMessages;

  for (const message of fulfillmentMessages) {
    if (message.text && message.text.text) {
      for (const [index, textToSynthesize] of message.text.text.entries()) {
        const outputFileName = `${intent}_message_${index}.mp3`;
        const messageUrl = await synthesizeSpeech(textToSynthesize, outputFileName);
        twiml.play(messageUrl);
      }
    }
  }

  if (intent === 'schedule.check' || intent === 'interruption.intent' || intent === 'cancel.intent') {
    twiml.hangup();
  }
}
async function detectIntent(sessionId: string, query: string) {
  if (!projectId) {
    throw new Error('projectId is not defined');
  }
  const sessionClient = new dialogflow.SessionsClient();
  const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: query,
        languageCode: 'ja-JP',
      },
    },
  };

  const [response] = await sessionClient.detectIntent(request);
  return response;
}
// TwiMLを返す関数
export const callingFunctions = functions.https.onRequest(async (request, response) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const callSid = request.body.CallSid;
  const sessionId = `${callSid}-${uuidv4()}`;

  if (request.body.SpeechResult) {
    // ユーザーの音声入力がある場合
    const userInput = request.body.SpeechResult;
    const dialogflowResponse = await detectIntent(sessionId, userInput);
    await handleDialogflowResponse(dialogflowResponse, twiml);
  } else {
    // 初回の呼び出し
    const dialogflowResponse = await detectIntent(sessionId, '');
    await handleDialogflowResponse(dialogflowResponse, twiml);
  }

  // 次の音声入力を待つ
  twiml.gather({
    input: ['speech'],
    language: 'ja-JP',
    speechTimeout: 'auto',
    action: `/callingFunctions?sessionId=${sessionId}`,
    method: 'POST'
  });

  response.type('text/xml');
  response.send(twiml.toString());
});

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