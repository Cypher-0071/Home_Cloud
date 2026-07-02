const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs/promises");
const mime = require("mime-types");
const multer = require("multer");
const si = require('systeminformation')

const BASE_DIR = "/home/rudra-unix";

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, req.query.path || BASE_DIR);
	},
	filename: (req, file, cb) => {
		cb(null, file.originalname);
	},
});

const upload = multer({ storage });

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

router.post("/upload", upload.single("file"), async (req, res) => {
	res.json("file uploaded successfully");
});

router.get("/download", async (req, res) => {
	const userPath = (req.query.path || "").replace(/^\//, "");
	const requestedPath = path.resolve(BASE_DIR, userPath);
	if (!requestedPath.startsWith(BASE_DIR)) {
		return res.status(403).json({ error: "Access denied" });
	} else {
		res.download(requestedPath);
	}
});

router.delete("/delete", async (req, res) => {
	const userPath = (req.query.path || "").replace(/^\//, "");
	const requestedPath = path.resolve(BASE_DIR, userPath);
	if (!requestedPath.startsWith(BASE_DIR)) {
		return res.status(403).json({ error: "Access denied" });
	} else {
		try {
			await fs.rm(requestedPath, { recursive: true, force: true });
			res.json({ success: "ok" });
		} catch (err) {
			console.error(err);
			return res.status(500).json({
				error: "Error deleting file",
			});
		}
	}
});

router.get('/drives', async (req, res) => {
	const drives = await si.fsSize();

	// Filesystem types that represent real, user-relevant storage
	const REAL_FS_TYPES = new Set([
		'ext4', 'ext3', 'ext2',  // Standard Linux
		'btrfs', 'xfs', 'zfs', 'f2fs', 'jfs', // Advanced Linux
		'drvfs',                  // WSL Windows drive mounts (/mnt/c, /mnt/e, etc.)
		'ntfs', 'exfat', 'vfat', 'fat32', 'fat16', // Windows/USB filesystems
		'apfs', 'hfs+',          // macOS
	]);

	const filtered = drives.filter(d => {
		// Must be a recognised real filesystem type
		if (!REAL_FS_TYPES.has((d.type || '').toLowerCase())) return false;
		// Drop WSLg paths (GUI subsystem internals)
		if (d.mount && d.mount.includes('wslg')) return false;
		// Drop paths that look like files rather than directories (e.g. /mnt/wslg/versions.txt)
		if (d.mount && /\.\w+$/.test(d.mount)) return false;
		return true;
	});

	res.json(filtered);
});

module.exports = router;
