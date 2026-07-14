const Docker = require("dockerode");
const docker = new Docker();
const express = require("express");
const router = express.Router();

const portBindings = {
	"8000/tcp": [{ HostPort: "3000" }],
};

router.get("/containers", async (req, res) => {
	try {
		const containers = await docker.listContainers({ all: true });
		res.json({ containers });
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});

router.post("/containers/:id/start", async (req, res) => {
	const container = docker.getContainer(req.params.id);

	try {
		await container.start();
		res.json({ success: true });
	} catch (err) {
		if (err.statusCode === 304)
			return res.status(409).json({ error: "Container is already running" });
		return res.status(500).json({ error: err.message });
	}
});

router.post("/containers/:id/stop", async (req, res) => {
	const container = docker.getContainer(req.params.id);

	try {
		await container.stop();
		res.json({ success: true });
	} catch (err) {
		if (err.statusCode === 304)
			return res.status(409).json({ error: "Container is already stopped" });
		return res.status(500).json({ error: err.message });
	}
});

router.post("/containers/:id/restart", async (req, res) => {
	const container = docker.getContainer(req.params.id);

	try {
		await container.restart();
		res.json({ success: true });
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});

router.delete("/containers/:id/delete", async (req, res) => {
	const container = docker.getContainer(req.params.id);

	try {
		await container.remove();
		res.json({ success: true });
	} catch (err) {
		if (err.statusCode === 409)
			return res.status(409).json({ error: "Stop the container before deleting it" });
		return res.status(500).json({ error: err.message });
	}
});

router.get("/containers/:id/stats", async (req, res) => {
	const container = docker.getContainer(req.params.id);

	try {
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		});

		res.flushHeaders();

		const statsStream = await container.stats({ stream: true });

		statsStream.on("data", (chunk) => {
			res.write(`data: ${chunk.toString("utf8")}\n\n`);
		});

		statsStream.on("end", () => {
			res.end();
		});

		statsStream.on("error", (err) => {
			console.error("[stats stream] error:", err.message);
			res.end();
		});

		req.on("close", () => {
			statsStream.destroy();
		});
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});

router.get("/containers/:id/inspect", async (req, res) => {
	const container = docker.getContainer(req.params.id);

	try {
		const data = await container.inspect();
		res.json({ data: data });
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});

module.exports = router;
