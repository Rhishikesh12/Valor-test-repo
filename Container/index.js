const {
	S3Client,
	GetObjectCommand,
	PutObjectCommand,
} = require("@aws-sdk/client-s3");
const fs = require("node:fs/promises");
const fsOld = require("fs");
const path = require("node:path");
const ffmpeg = require("fluent-ffmpeg");
require("dotenv").config();

const RESOLUTIONS = [
	{ name: "720p", width: 1280, height: 720 },
	{ name: "480p", width: 854, height: 480 },
	{ name: "360p", width: 480, height: 360 },
];
const s3client = new S3Client({
	region: process.env.AWS_REGION,
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	},
});

// env variables
const BUCKET_NAME = process.env.BUCKET_NAME;
const KEY = process.env.KEY;
const PROD = process.env.PROD_BUCKET_NAME;

if (!BUCKET_NAME || !KEY || !PROD) {
	console.error(
		"Please provide BUCKET_NAME, KEY and PROD NAME in the .env file"
	);
	process.exit(1);
}

// Generate a unique identifier for this transcoding session
const generateUniqueIdentifier = () => {
	return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

async function init() {
	// Generate a unique identifier for this video processing run
	const uniqueSessionId = generateUniqueIdentifier();

	// Download the video
	try {
		const command = new GetObjectCommand({
			Bucket: BUCKET_NAME,
			Key: KEY,
		});
		const result = await s3client.send(command);
		const originalFilePath = "originalVideo.mp4";
		await fs.writeFile(originalFilePath, result.Body);
		const originalVideoPath = path.resolve(originalFilePath);

		// transcode the video
		const promise = RESOLUTIONS.map((resolution) => {
			const output = `video-${uniqueSessionId}-${resolution.name}.mp4`;
			return new Promise((resolve) => {
				ffmpeg(originalVideoPath)
					.output(output)
					.withVideoCodec("libx264")
					.withAudioCodec("aac")
					.withSize(`${resolution.width}x${resolution.height}`)
					.on("start", () => {
						console.log(`${resolution.width}x${resolution.height}`);
					})
					.on("end", async () => {
						const putCommand = new PutObjectCommand({
							Bucket: PROD,
							Key: `transcoded/${output}`,
							Body: fsOld.createReadStream(path.resolve(output)),
						});
						await s3client.send(putCommand);
						console.log(`Uploaded ${output}`);
						resolve();
					})
					.format("mp4")
					.run();
			});
		});

		await Promise.all(promise);
		console.log("All videos processed successfully.");
	} catch (error) {
		console.error("Error in processing:", error);
	} finally {
		try {
			await fs.unlink("originalVideo.mp4");
		} catch (cleanupError) {
			console.warn("Could not delete original video file:", cleanupError);
		}
	}
}
init();
