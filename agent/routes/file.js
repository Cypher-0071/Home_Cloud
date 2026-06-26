const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs/promises");
const mime = require("mime-types");
const multer = require("multer")

const BASE_DIR = "/home/rudra-unix";

const storage = multer.diskStorage({
	destination: (req, file, cb) =>{
		cb(null, req.query.path || BASE_DIR)
	},
	filename: (req, file, cb) =>{
		cb(null, file.originalname)
	}
})

const upload = multer({storage})

router.get("/", async (req, res) => {
	const userPath = (req.query.path || "").replace(/^\//, "");
	const requestedPath = path.resolve(BASE_DIR, userPath);
	if (!requestedPath.startsWith(BASE_DIR)) {
		return res.status(403).json({ error: "Access denied" });
	} else {
		try {
			const files = await fs.readdir(requestedPath);
			const metadata = await Promise.all(
				files.map(async (file) => {
					const filepath = path.join(requestedPath, file);
					const stat = await fs.stat(filepath);
					return {
						name: file,
						isDirectory: stat.isDirectory(),
						size: stat.size,
						modified: stat.mtime,
						mimeType: stat.isDirectory()
							? null
							: mime.lookup(file) || "application/octet-stream",
					};
				}),
			);
			res.json({ path: requestedPath, files: metadata });
		} catch (err) {
			console.log(err);
			return res.status(403).json({ error: "Error reading directory" });
		}
	}
});

router.post("/upload", upload.single('file'), async (req, res)=>{
	res.json("file uploaded successfully")
});

module.exports = router;
