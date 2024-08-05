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
exports.dialogflowWebhook = exports.scheduledCall = void 0;
const functions = __importStar(require("firebase-functions"));
const dialogflow_fulfillment_1 = require("dialogflow-fulfillment");
const twilio_1 = __importDefault(require("twilio"));
require('dotenv').config();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = (0, twilio_1.default)(accountSid, authToken);
const calling_functionsURL = process.env.CALLING_FUNCTIONS_URL;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const toNumber = process.env.TEST_PHONE_NUMBER;
// 共通の通話発信ロジック
async function initiateCall() {
    return await client.calls.create({
        url: calling_functionsURL,
        to: toNumber,
        from: fromNumber,
    });
}
// Cloud Scheduler用の関数
exports.scheduledCall = functions.https.onRequest(async (req, res) => {
    try {
        const call = await initiateCall();
        console.log(`Scheduled call initiated with SID: ${call.sid}`);
        res.status(200).send('Call initiated successfully');
    }
    catch (error) {
        console.error('Error initiating scheduled call:', error);
        res.status(500).send('Error initiating call');
    }
});
// Dialogflow用の関数
exports.dialogflowWebhook = functions.https.onRequest((request, response) => {
    try {
        const agent = new dialogflow_fulfillment_1.WebhookClient({ request, response });
        const intentMap = new Map();
        intentMap.set('Make Call Intent', makeCallHandler);
        agent.handleRequest(intentMap);
    }
    catch (error) {
        console.error('Error in dialogflowWebhook:', error);
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
//# sourceMappingURL=index.js.map