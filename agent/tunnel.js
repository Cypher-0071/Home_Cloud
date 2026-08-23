const { spawn } = require("node:child_process");
const { CF_CONFIG, TUNNEL_NAME, CF_DOMAIN } = require("./config");

let activeChild = null;

function startTunnel() {
	return new Promise((resolve, reject) => {
		if (activeChild) {
			try {
				activeChild.kill("SIGTERM");
			} catch (e) {}
		}

		const child = spawn("cloudflared", [
			"tunnel",
			"--config",
			CF_CONFIG,
			"run",
			TUNNEL_NAME,
		]);

		activeChild = child;
		let resolved = false;

		child.stderr.on("data", (data) => {
			const str = data.toString();
			console.log(str);
			if (
				!resolved &&
				(str.includes("Registered tunnel connection") ||
					str.includes("INF Registered tunnel connection"))
			) {
				resolved = true;
				resolve(`https://dash.${CF_DOMAIN}`);
			}
		});

		child.on("error", (err) => {
			if (!resolved) reject(err);
		});

		child.on("close", (code) => {
			console.log(`[tunnel] Cloudflare process exited with code ${code}`);
			if (activeChild === child) {
				activeChild = null;
			}
		});
	});
}

function restartTunnel() {
	return startTunnel();
}

module.exports = { startTunnel, restartTunnel };
