import { useState } from "react";
import axios from "axios";

const VideoUpload = () => {
	const [file, setFile] = useState(null);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [uploadProgress, setUploadProgress] = useState(0);
	const [uploadStatus, setUploadStatus] = useState("");

	const handleFileChange = (e) => {
		const selectedFile = e.target.files[0];

		// Validate file type and size
		if (selectedFile) {
			const allowedTypes = ["video/mp4", "video/mpeg", "video/quicktime"];
			const maxSize = 50 * 1024 * 1024; // 50MB

			if (!allowedTypes.includes(selectedFile.type)) {
				alert("Please upload a valid video file (MP4, MPEG, MOV)");
				return;
			}

			if (selectedFile.size > maxSize) {
				alert("File is too large. Maximum size is 50MB");
				return;
			}

			setFile(selectedFile);
		}
	};

	const handleUpload = async (e) => {
		e.preventDefault();

		if (!file) {
			alert("Please select a video file");
			return;
		}

		const formData = new FormData();
		formData.append("video", file);
		formData.append("title", title);
		formData.append("description", description);

		try {
			setUploadStatus("Uploading...");
			setUploadProgress(0);

			const response = await axios.post(
				"http://localhost:5000/upload-video",
				formData,
				{
					headers: {
						"Content-Type": "multipart/form-data",
					},
					onUploadProgress: (progressEvent) => {
						const percentCompleted = Math.round(
							(progressEvent.loaded * 100) / progressEvent.total
						);
						setUploadProgress(percentCompleted);
					},
				}
			);

			setUploadStatus("Upload Successful!");
			// Optional: Handle successful upload (e.g., show video details, reset form)
			console.log("Upload response:", response.data);

			// Reset form
			setFile(null);
			setTitle("");
			setDescription("");
		} catch (error) {
			setUploadStatus("Upload Failed");
			console.error("Upload error:", error);
			alert("Video upload failed");
		}
	};

	return (
		<div className='max-w-md mx-auto p-6 bg-white rounded-lg shadow-md'>
			<h2 className='text-2xl font-bold mb-4'>Upload Video</h2>

			<form onSubmit={handleUpload}>
				<div className='mb-4'>
					<input
						type='text'
						placeholder='Video Title'
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						className='w-full p-2 border rounded'
						required
					/>
				</div>

				<div className='mb-4'>
					<textarea
						placeholder='Video Description'
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						className='w-full p-2 border rounded'
						rows='3'
					/>
				</div>

				<div className='mb-4'>
					<input
						type='file'
						accept='video/mp4,video/mpeg,video/quicktime'
						onChange={handleFileChange}
						className='w-full'
					/>
				</div>

				{file && (
					<div className='mb-4'>
						<p>Selected File: {file.name}</p>
						<p>File Size: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
					</div>
				)}

				{uploadProgress > 0 && (
					<div className='mb-4'>
						<div
							className='bg-blue-500 h-2 rounded'
							style={{ width: `${uploadProgress}%` }}
						/>
						<p>{uploadProgress}% Uploaded</p>
					</div>
				)}

				<button
					type='submit'
					className='w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600'
					disabled={!file}>
					Upload Video
				</button>

				{uploadStatus && <p className='mt-4 text-center'>{uploadStatus}</p>}
			</form>
		</div>
	);
};

export default VideoUpload;
