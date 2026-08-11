const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const Docker = require("dockerode");
const DockerCompose = require("dockerode-compose");
const docker = new Docker();

const STACKS_DIR = path.join(os.homedir(), ".home-cloud", "stacks");
if (!fs.existsSync(STACKS_DIR)) {
	fs.mkdirSync(STACKS_DIR, { recursive: true });
}

// GET /api/docker/stacks - List all stacks
router.get("/", async (req, res) => {
	try {
		const containers = await docker.listContainers({ all: true });

		const stackContainersMap = {};
		for (const c of containers) {
			const project = c.Labels ? c.Labels["com.docker.compose.project"] : null;
			if (project) {
				if (!stackContainersMap[project]) {
					stackContainersMap[project] = [];
				}
				stackContainersMap[project].push({
					id: c.Id,
					name: (c.Names && c.Names[0] ? c.Names[0] : "").replace(/^\//, ""),
					service: c.Labels["com.docker.compose.service"] || "unknown",
					image: c.Image,
					state: c.State,
					status: c.Status,
				});
			}
		}

		let stackFolders = [];
		if (fs.existsSync(STACKS_DIR)) {
			const entries = fs.readdirSync(STACKS_DIR, { withFileTypes: true });
			stackFolders = entries.filter((e) => e.isDirectory()).map((e) => e.name);
		}

		const allStackNames = Array.from(
			new Set([...stackFolders, ...Object.keys(stackContainersMap)]),
		);

		const stacks = allStackNames.map((name) => {
			const stackPath = path.join(STACKS_DIR, name, "docker-compose.yml");
			const yamlExists = fs.existsSync(stackPath);
			const cList = stackContainersMap[name] || [];
			const runningCount = cList.filter((c) => c.state === "running").length;

			let status = "uncreated";
			if (cList.length > 0) {
				if (runningCount === cList.length) status = "running";
				else if (runningCount > 0) status = "partial";
				else status = "stopped";
			}

			return {
				name,
				status,
				servicesCount: cList.length,
				runningServicesCount: runningCount,
				containers: cList,
				yamlExists,
			};
		});

		res.json({ stacks });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// GET /api/docker/stacks/:name - Get stack details & yaml content
router.get("/:name", async (req, res) => {
	const { name } = req.params;
	const stackPath = path.join(STACKS_DIR, name, "docker-compose.yml");

	try {
		if (!fs.existsSync(stackPath)) {
			return res.status(404).json({ error: `Stack '${name}' not found` });
		}
		const yaml = fs.readFileSync(stackPath, "utf8");

		const containers = await docker.listContainers({ all: true });
		const stackContainers = containers
			.filter((c) => c.Labels && c.Labels["com.docker.compose.project"] === name)
			.map((c) => ({
				id: c.Id,
				name: (c.Names && c.Names[0] ? c.Names[0] : "").replace(/^\//, ""),
				service: c.Labels["com.docker.compose.service"] || "unknown",
				image: c.Image,
				state: c.State,
				status: c.Status,
			}));

		res.json({ name, yaml, containers: stackContainers });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// POST /api/docker/stacks/deploy - Save & Deploy stack with live SSE progress stream
router.post("/deploy", async (req, res) => {
	const { name, yaml } = req.body;

	if (!name || !yaml) {
		return res.status(400).json({ error: "Stack name and YAML content are required" });
	}

	const stackFolder = path.join(STACKS_DIR, name);
	const filePath = path.join(stackFolder, "docker-compose.yml");

	try {
		if (!fs.existsSync(stackFolder)) {
			fs.mkdirSync(stackFolder, { recursive: true });
		}
		fs.writeFileSync(filePath, yaml, "utf8");

		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		});
		res.flushHeaders();

		const child = spawn("docker", ["compose", "-f", filePath, "-p", name, "up", "-d", "--remove-orphans"]);

		child.stdout.on("data", (chunk) => {
			res.write(`data: ${JSON.stringify({ text: chunk.toString("utf8") })}\n\n`);
		});

		child.stderr.on("data", (chunk) => {
			res.write(`data: ${JSON.stringify({ text: chunk.toString("utf8") })}\n\n`);
		});

		child.on("close", (code) => {
			res.write(`data: ${JSON.stringify({ status: code === 0 ? "success" : "failed", exitCode: code })}\n\n`);
			res.end();
		});

		req.on("close", () => {
			if (!child.killed) {
				child.kill();
			}
		});
	} catch (err) {
		if (!res.headersSent) {
			res.status(500).json({ error: err.message });
		} else {
			res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
			res.end();
		}
	}
});

// POST /api/docker/stacks/:name/start - Start stack containers
router.post("/:name/start", async (req, res) => {
	const { name } = req.params;
	const stackPath = path.join(STACKS_DIR, name, "docker-compose.yml");

	try {
		if (fs.existsSync(stackPath)) {
			const compose = new DockerCompose(docker, stackPath, name);
			await compose.up();
		} else {
			const child = spawn("docker", ["compose", "-p", name, "start"]);
			await new Promise((resolve, reject) => {
				child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Exit code ${code}`))));
			});
		}
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// POST /api/docker/stacks/:name/stop - Stop stack containers
router.post("/:name/stop", async (req, res) => {
	const { name } = req.params;
	const stackPath = path.join(STACKS_DIR, name, "docker-compose.yml");

	try {
		if (fs.existsSync(stackPath)) {
			const compose = new DockerCompose(docker, stackPath, name);
			await compose.down();
		} else {
			const child = spawn("docker", ["compose", "-p", name, "stop"]);
			await new Promise((resolve, reject) => {
				child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Exit code ${code}`))));
			});
		}
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// DELETE /api/docker/stacks/:name - Remove stack containers and directory
router.delete("/:name", async (req, res) => {
	const { name } = req.params;
	const stackFolder = path.join(STACKS_DIR, name);
	const stackPath = path.join(stackFolder, "docker-compose.yml");

	try {
		if (fs.existsSync(stackPath)) {
			const compose = new DockerCompose(docker, stackPath, name);
			await compose.down({ volumes: true }).catch(() => null);
		} else {
			const child = spawn("docker", ["compose", "-p", name, "down", "-v"]);
			await new Promise((resolve) => child.on("close", resolve));
		}

		if (fs.existsSync(stackFolder)) {
			fs.rmSync(stackFolder, { recursive: true, force: true });
		}

		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// GET /api/docker/stacks/:name/logs - Stream multi-container stack logs via SSE
router.get("/:name/logs", async (req, res) => {
	const { name } = req.params;
	const stackPath = path.join(STACKS_DIR, name, "docker-compose.yml");

	try {
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		});
		res.flushHeaders();

		const child = spawn("docker", ["compose", "-f", stackPath, "-p", name, "logs", "-f", "--tail=200", "--timestamps"]);

		child.stdout.on("data", (chunk) => {
			res.write(`data: ${JSON.stringify({ text: chunk.toString("utf8") })}\n\n`);
		});

		child.stderr.on("data", (chunk) => {
			res.write(`data: ${JSON.stringify({ text: chunk.toString("utf8") })}\n\n`);
		});

		req.on("close", () => {
			if (!child.killed) {
				child.kill();
			}
		});
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;