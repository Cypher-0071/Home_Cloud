const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs/promises");
const mime = require("mime-types");
const multer = require("multer");
const si = require("systeminformation");
const { spawn } = require("child_process");
const { stdout, stderr } = require("process");
const { error } = require("console");
const BASE_DIR = "/home/rudra-unix";

// Resolve an incoming path param safely.
// Accepts both absolute paths (/home/rudra-unix/foo) and relative ones (foo).
// Always blocks traversal outside BASE_DIR.
function resolvePath(userPath) {
	const p = String(userPath || "");
	return path.isAbsolute(p) ? path.resolve(p) : path.resolve(BASE_DIR, p);
}

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		const dest = resolvePath(req.query.path);
		// Block uploads outside BASE_DIR
		if (!dest.startsWith(BASE_DIR)) {
			return cb(
				new Error(
					"Access denied: upload destination is outside allowed directory",
				),
			);
		}
		cb(null, dest);
	},
	filename: (req, file, cb) => {
		cb(null, file.originalname);
	},
});

const upload = multer({ storage });

router.get("/", async (req, res) => {
	const requestedPath = resolvePath(req.query.path);
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
	const requestedPath = resolvePath(req.query.path);
	if (!requestedPath.startsWith(BASE_DIR)) {
		return res.status(403).json({ error: "Access denied" });
	} else {
		res.download(requestedPath);
	}
});

router.delete("/delete", async (req, res) => {
	const requestedPath = resolvePath(req.query.path);
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

router.get("/drives", async (req, res) => {
	const drives = await si.fsSize();

	// Filesystem types that represent real, user-relevant storage
	const REAL_FS_TYPES = new Set([
		"ext4",
		"ext3",
		"ext2", // Standard Linux
		"btrfs",
		"xfs",
		"zfs",
		"f2fs",
		"jfs", // Advanced Linux
		"drvfs", // WSL Windows drive mounts (/mnt/c, /mnt/e, etc.)
		"ntfs",
		"exfat",
		"vfat",
		"fat32",
		"fat16", // Windows/USB filesystems
		"apfs",
		"hfs+", // macOS
	]);

	const filtered = drives.filter((d) => {
		// Must be a recognised real filesystem type
		if (!REAL_FS_TYPES.has((d.type || "").toLowerCase())) return false;
		// Drop WSLg paths (GUI subsystem internals)
		if (d.mount && d.mount.includes("wslg")) return false;
		// Drop paths that look like files rather than directories (e.g. /mnt/wslg/versions.txt)
		if (d.mount && /\.\w+$/.test(d.mount)) return false;
		return true;
	});

	res.json(filtered);
});

router.get("/view", async (req, res) => {
	const requestedPath = resolvePath(req.query.path);
	if (!requestedPath.startsWith(BASE_DIR)) {
		return res.status(403).json({ error: "Access denied" });
	}
	const mimeType = mime.lookup(requestedPath) || "application/octet-stream";
	res.setHeader("Content-Disposition", "inline");
	res.setHeader("Content-Type", mimeType);
	res.sendFile(requestedPath);
});

router.post("/copy", async (req, res) => {
	const src = resolvePath(req.body.src);
	const dest = resolvePath(req.body.dest);

	if (!src.startsWith(BASE_DIR) || !dest.startsWith(BASE_DIR)) {
		return res.status(403).json({ error: "Access denied" });
	}

	// Enforce same-path check on the server
	if (src === dest) {
		return res
			.status(400)
			.json({ error: "Source and destination are the same path" });
	}

	// Enforce destination-exists check on the server
	// fs.access resolves if the path exists, throws if it doesn't
	try {
		await fs.access(dest);
		// If we reach here, dest exists — reject
		return res.status(409).json({
			error: `"${path.basename(dest)}" already exists at the destination`,
		});
	} catch {
		// dest does not exist — safe to proceed
	}

	try {
		await fs.cp(src, dest, { recursive: true });
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

router.get("/search", async (req, res) => {
	const query = String(req.query.search || "");
	const currentDir = resolvePath(req.query.path);

	if (!currentDir.startsWith(BASE_DIR)) {
		return res.status(403).json({ error: "Access denied" });
	}

	if (!query) {
		return res.json([]);
	}
	// Spawn fd to recursively list all file paths (colorless, starting at currentDir)
	const fd = spawn("fdfind", ["--color", "never", ".", currentDir]);
	// Spawn fzf in filter mode to perform fast fuzzy matching on the incoming file list
	const fzf = spawn("fzf", ["-f", query]);

	// Pipe the output of fd directly into fzf's input
	fd.stdout.pipe(fzf.stdin);

	let stdout = "";
	let stderr = "";

	fzf.stdout.on("data", (data) => {
		stdout += data;
	});

	fzf.stderr.on("data", (data) => {
		stderr += data;
	});

	fzf.on("close", async (code) => {
		// fzf exits with code 1 if no matches are found, which is a normal state
		if (code !== 0 && code !== 1 && stderr) {
			console.error(`fzf search error: ${stderr}`);
			return res.status(500).json({ error: "Search failed" });
		}

		const filePaths = stdout.split("\n").filter(Boolean).slice(0, 50); // limit to top 50 matches

		try {
			const metadata = await Promise.all(
				filePaths.map(async (filepath) => {
					try {
						const stat = await fs.stat(filepath);
						return {
							name: path.basename(filepath),
							path: filepath,
							isDirectory: stat.isDirectory(),
							size: stat.size,
							modified: stat.mtime,
							mimeType: stat.isDirectory()
								? null
								: mime.lookup(filepath) ||
									"application/octet-stream",
						};
					} catch {
						return null;
					}
				}),
			);
			res.json(metadata.filter(Boolean));
		} catch (err) {
			console.error(err);
			res.status(500).json({ error: "Failed to gather file metadata" });
		}
	});

	// If the client aborts the request, kill both processes immediately
	req.on("close", () => {
		if (fd.killed === false) fd.kill();
		if (fzf.killed === false) fzf.kill();
	});
});

router.patch("/rename", async (req, res) => {
	const oldPath = resolvePath(req.body.oldPath);
	const newPath = resolvePath(req.body.newPath);

	// Validate both paths are inside BASE_DIR
	if (!oldPath.startsWith(BASE_DIR) || !newPath.startsWith(BASE_DIR)) {
		return res.status(403).json({ error: "Access denied" });
	}

	// Prevent renaming to the same name/path
	if (oldPath === newPath) {
		return res
			.status(400)
			.json({ error: "New path is identical to the old path" });
	}

	// Verify destination does not already exist
	try {
		await fs.access(newPath);
		return res
			.status(409)
			.json({
				error: `A file or folder named "${path.basename(newPath)}" already exists`,
			});
	} catch {
		// safe to rename
	}

	try {
		await fs.rename(oldPath, newPath);
		res.json({ success: true });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: error.message });
	}
});

router.post("/folder", async (req, res) => {
	const folderName = String(req.body.name || "").trim();
	const destination = resolvePath(req.body.path);
	const targetDir = resolvePath(path.join(destination, folderName));

	if (!targetDir.startsWith(BASE_DIR)) {
		return res.status(403).json({ error: "Access denied" });
	}

	if (!folderName) {
		return res.status(400).json({ error: "Folder name is required" });
	}

	// Verify folder doesn't already exist
	try {
		await fs.access(targetDir);
		return res
			.status(409)
			.json({
				error: `A file or folder named "${folderName}" already exists here`,
			});
	} catch {
		// safe to create
	}

	try {
		await fs.mkdir(targetDir, { recursive: true });
		res.json({ success: true });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: error.message });
	}
});

router.post("/file", async (req, res) => {
	const fileName = String(req.body.name || "").trim();
	const destination = resolvePath(req.body.path);
	const targetFile = resolvePath(path.join(destination, fileName));

	if (!targetFile.startsWith(BASE_DIR)) {
		return res.status(403).json({ error: "Access denied" });
	}

	if (!fileName) {
		return res.status(400).json({ error: "File name is required" });
	}

	// Verify file doesn't already exist
	try {
		await fs.access(targetFile);
		return res
			.status(409)
			.json({
				error: `A file or folder named "${fileName}" already exists here`,
			});
	} catch {
		// safe to create
	}

	try {
		await fs.writeFile(targetFile, "");
		res.json({ success: true });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: error.message });
	}
});

router.patch("/move", async (req, res) => {
	const src = resolvePath(req.body.oldPath);
	const dest = resolvePath(req.body.newPath);

	// Validate both paths are inside BASE_DIR
	if (!src.startsWith(BASE_DIR) || !dest.startsWith(BASE_DIR)) {
		return res.status(403).json({ error: "Access denied" });
	}

	if (src === dest) {
		return res.json({ success: true });
	}

	// Verify destination does not already exist
	try {
		await fs.access(dest);
		return res.status(409).json({ error: `A file or folder named "${path.basename(dest)}" already exists` });
	} catch {
		// safe to move
	}

	try {
		await fs.rename(src, dest);
		res.json({ success: true });
	} catch (err) {
		if (err.code === "EXDEV") {
			// Cross-device fallback: copy then delete original
			try {
				await fs.cp(src, dest, { recursive: true });
				await fs.rm(src, { recursive: true, force: true });
				return res.json({ success: true });
			} catch (fallbackErr) {
				return res.status(500).json({ error: fallbackErr.message });
			}
		}
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;
