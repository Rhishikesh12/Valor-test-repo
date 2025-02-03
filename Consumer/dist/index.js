"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_sqs_1 = require("@aws-sdk/client-sqs");
const client_ecs_1 = require("@aws-sdk/client-ecs");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const client = new client_sqs_1.SQSClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const ecsClient = new client_ecs_1.ECSClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
function init() {
    return __awaiter(this, void 0, void 0, function* () {
        const command = new client_sqs_1.ReceiveMessageCommand({
            QueueUrl: process.env.SQS_QUEUE_URL,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 20,
        });
        try {
            while (true) {
                // Continuous polling loop
                const { Messages } = yield client.send(command);
                if (!Messages) {
                    console.log("No messages to process");
                    continue; // Continue polling
                }
                for (const message of Messages) {
                    const { MessageId, Body } = message;
                    console.log(`Message Received, MessageID: ${MessageId}, Body: ${Body}`);
                    if (!Body) {
                        console.log("Message Body is empty, skipping...");
                        continue;
                    }
                    const event = JSON.parse(Body);
                    // Ignore test events
                    if ("Service" in event &&
                        "Event" in event &&
                        event.Event === "s3:TestEvent") {
                        yield client.send(new client_sqs_1.DeleteMessageCommand({
                            QueueUrl: process.env.SQS_QUEUE_URL,
                            ReceiptHandle: message.ReceiptHandle,
                        }));
                        continue; // Continue polling instead of returning
                    }
                    for (const record of event.Records) {
                        const { s3 } = record;
                        const { bucket, object: { key }, } = s3;
                        const runTaskCommand = new client_ecs_1.RunTaskCommand({
                            taskDefinition: "arn:aws:ecs:us-east-1:183631315724:task-definition/video-transcoder",
                            cluster: "arn:aws:ecs:us-east-1:183631315724:cluster/Development",
                            launchType: "FARGATE",
                            networkConfiguration: {
                                awsvpcConfiguration: {
                                    assignPublicIp: "ENABLED",
                                    securityGroups: ["sg-0d19e3b522dba6baa"],
                                    subnets: [
                                        "subnet-09c9cc33a961f65c5",
                                        "subnet-0fc260878341acdf8",
                                        "subnet-0871a70bd76db9b24",
                                    ],
                                },
                            },
                            overrides: {
                                containerOverrides: [
                                    {
                                        name: "video-transcoder",
                                        environment: [
                                            { name: "BUCKET_NAME", value: bucket.name },
                                            { name: "KEY", value: key },
                                        ],
                                    },
                                ],
                            },
                        });
                        yield ecsClient.send(runTaskCommand);
                    }
                    // Delete the message after processing
                    yield client.send(new client_sqs_1.DeleteMessageCommand({
                        QueueUrl: process.env.SQS_QUEUE_URL,
                        ReceiptHandle: message.ReceiptHandle,
                    }));
                }
            }
        }
        catch (error) {
            console.log(error);
        }
    });
}
init();
