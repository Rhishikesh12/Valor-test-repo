const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
	{
		videos: {
			video_title: {
				type: String,
				required: true,
			},
			video_desc: {
				type: String,
			},
			uploaded_video: {
				type: String,
				required: true,
			},
			video_quality: {
				"360p": {
					type: String,
				},
				"480p": {
					type: String,
				},
				"720p": {
					type: String,
				},
			},
			likes: {
				type: Number,
				default: 0,
			},
			views: {
				type: Number,
				default: 0,
			},
			thumbnail: {
				type: String,
			},
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model("VideoModel", videoSchema);
