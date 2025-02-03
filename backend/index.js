const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");
const VideoModel = require("./model/videoSchema");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose
	.connect(process.env.MONGO_URL)
	.then(() => console.log("DB Connection Successfull!"))
	.catch((err) => {
		console.log(err);
	});

const s3Client = new S3Client({
	region: process.env.AWS_REGION,
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	},
});

//multer
const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 1024 * 1024 * 100,
	},
	fileFilter: (req, file, cb) => {
		if (file.mimetype.startsWith("video/")) {
			cb(null, true);
		} else {
			cb(new Error("Not a video file"), false);
		}
	},
});

// Video Upload
app.post("/upload-video", upload.single("video"), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ message: "No file uploaded" });
		}

		const fileName = `videos/${uuidv4()}-${req.file.originalname}`;

		const uploadParams = {
			Bucket: process.env.S3_BUCKET_NAME,
			Key: fileName,
			Body: req.file.buffer,
			ContentType: req.file.mimetype,
		};

		const command = new PutObjectCommand(uploadParams);
		await s3Client.send(command);

		const videoUrl = `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${fileName}`;

		const videoMetadata = new VideoModel({
			videos: {
				video_title: req.body.title || "Untitled Video",
				video_desc: req.body.description || "",
				uploaded_video: videoUrl,
				video_quality: {},
				likes: 0,
				views: 0,
				thumbnail: null,
			},
		});

		await videoMetadata.save();

		res.status(200).json({
			message: "Video uploaded successfully",
			videoUrl,
			videoId: videoMetadata._id,
		});
	} catch (error) {
		console.error("Upload error:", error);
		res
			.status(500)
			.json({ message: "Video upload failed", error: error.message });
	}
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
