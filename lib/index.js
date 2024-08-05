"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dialogflowWebhook = exports.scheduledCall = exports.callStatusCallback = void 0;
const functions = __importStar(require("firebase-functions"));
const dialogflow_fulfillment_1 = require("dialogflow-fulfillment");
const secret_manager_1 = require("@google-cloud/secret-manager");
const twilio_1 = __importDefault(require("twilio"));
const secretManager = new secret_manager_1.SecretManagerServiceClient();
async function getSecret(secretName) {
    const [version] = await secretManager.accessSecretVersion({
        name: `projects/304315430389/secrets/${secretName}/versions/latest`,
    });
    const value = version.payload.data.toString();
    if (!value) {
        throw new Error(`Secret ${secretName} is not set`);
    }
    return value;
}
async function initializeTwilioClient() {
    const accountSid = await getSecret('TWILIO_ACCOUNT_SID');
    const authToken = await getSecret('TWILIO_AUTH_TOKEN');
    return (0, twilio_1.default)(accountSid, authToken);
}
let twilioClient;
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
exports.callStatusCallback = functions.https.onRequest(async (req, res) => {
    const callSid = req.body.CallSid;
    const callStatus = req.body.CallStatus;
    console.log(`Call ${callSid} status changed to ${callStatus}`);
    // ここでステータス変更に応じた処理を行う
    // 例: データベースの更新、通知の送信など
    res.status(200).send('OK');
});
// Cloud Scheduler用の関数
// Cloud Scheduler用の関数
exports.scheduledCall = functions.https.onRequest(async (req, res) => {
    try {
        const call = await initiateCall();
        console.log(`Scheduled call initiated with SID: ${call.sid}`);
        res.status(200).send('Call initiated successfully');
    }
    catch (error) {
        console.error('Error initiating scheduled call:', error instanceof Error ? error.message : String(error));
        res.status(500).send('Error initiating call');
    }
});
// Dialogflow用の関数
exports.dialogflowWebhook = functions.https.onRequest(async (request, response) => {
    try {
        const agent = new dialogflow_fulfillment_1.WebhookClient({ request, response });
        const intentMap = new Map();
        intentMap.set('Make Call Intent', makeCallHandler);
        await agent.handleRequest(intentMap);
    }
    catch (error) {
        console.error('Error in dialogflowWebhook:', error instanceof Error ? error.message : String(error));
        response.status(500).send('Error processing Dialogflow request');
    }
});
// Dialogflowの発信インテントハンドラー
const makeCallHandler = async (agent) => {
    try {
        const call = await initiateCall();
        console.log(call.sid);
        agent.add('発信しました。');
    }
    catch (error) {
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
//# sourceMappingURL=index.js.map