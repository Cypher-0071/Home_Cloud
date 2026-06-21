const express = require("express");
const router = express.Router();
const si = require("systeminformation");
async function getMetrics() {
	const cpu = await si.currentLoad();
	const mem = await si.mem();
	const disk = await si.fsSize();
	return { cpu, mem, disk };
}

router.get("/", (req, res) => {
	res.set("Content-Type", "text/event-stream");
	res.set("Cache-Control", "no-cache");
	res.set("Connection", "keep-alive");
	res.flushHeaders();

	const interval = setInterval(async () => {
		const data = await getMetrics();
		res.write(`data: ${JSON.stringify(data)}\n\n`);
	}, 1000);
	req.on("close", () => clearInterval(interval));
});

module.exports = router;
