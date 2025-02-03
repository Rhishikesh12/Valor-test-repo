import {
	SQSClient,
	ReceiveMessageCommand,
	DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import type { S3Event } from "aws-lambda";
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";

import dotenv from "dotenv";
dotenv.config();

const client = new SQSClient({
	region: process.env.AWS_REGION!,
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
	},
});

const ecsClient = new ECSClient({
	region: process.env.AWS_REGION!,
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
	},
});

async function init() {
	const command = new ReceiveMessageCommand({
		QueueUrl: process.env.SQS_QUEUE_URL!,
		MaxNumberOfMessages: 1,
		WaitTimeSeconds: 20,
	});

	try {
		while (true) {
			// Continuous polling loop
			const { Messages } = await client.send(command);
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

				const event = JSON.parse(Body) as S3Event;

				// Ignore test events
				if (
					"Service" in event &&
					"Event" in event &&
					event.Event === "s3:TestEvent"
				) {
					await client.send(
						new DeleteMessageCommand({
							QueueUrl: process.env.SQS_QUEUE_URL!,
							ReceiptHandle: message.ReceiptHandle!,
						})
					);
					continue; // Continue polling instead of returning
				}

				for (const record of event.Records) {
					const { s3 } = record;
					const {
						bucket,
						object: { key },
					} = s3;

					const runTaskCommand = new RunTaskCommand({
						taskDefinition:
							"arn:aws:ecs:us-east-1:183631315724:task-definition/video-transcoder",
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

					await ecsClient.send(runTaskCommand);
				}

				// Delete the message after processing
				await client.send(
					new DeleteMessageCommand({
						QueueUrl: process.env.SQS_QUEUE_URL!,
						ReceiptHandle: message.ReceiptHandle!,
					})
				);
			}
		}
	} catch (error) {
		console.log(error);
	}
}

init();
