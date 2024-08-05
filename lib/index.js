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
Object.defineProperty(exports, "__esModule", { value: true });
exports.dialogflowWebhook = void 0;
const functions = __importStar(require("firebase-functions"));
const dialogflow_fulfillment_1 = require("dialogflow-fulfillment");
const twilio = require("twilio");
require('dotenv').config();
const accountSid = process.env.TWILIO_ACCOUNT_SID; // TwilioのアカウントSID
const authToken = process.env.TWILIO_AUTH_TOKEN; // Twilioの認証トークン
const client = twilio(accountSid, authToken);
const fromNumber = process.env.TWILIO_PHONE_NUMBER; // 発信元のTwilio電話番号
const toNumber = process.env.TEST_PHONE_NUMBER; // 発信先の電話番号（テスト用）
const makeCallHandler = (agent) => {
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
exports.dialogflowWebhook = functions.https.onRequest((request, response) => {
    const agent = new dialogflow_fulfillment_1.WebhookClient({ request, response });
    const intentMap = new Map();
    intentMap.set('Make Call Intent', makeCallHandler); // 発信インテントをハンドラーに登録
    agent.handleRequest(intentMap);
});
//# sourceMappingURL=index.js.map