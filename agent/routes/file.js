const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs/promises");
const mime = require("mime-types");

const BASE_DIR = "/home/rudra-unix";

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


module.exports = router;
