const { spawn } = require("node:child_process");

function startTunnel() {
	return new Promise((resolve, reject) => {
		const child = spawn("cloudflared", [
			"tunnel",
			"--credentials-file",
			"/home/rudra-unix/.cloudflared/48d01e09-e50b-47da-bb93-3a679b0f4d71.json",
			"run",
			"--url",
			"http://localhost:3000",
			"home-cloud",
		]);
		child.stderr.on("data", (data) => {
			console.log(data.toString());
			if (
				data
					.toString()
					.includes("Registered tunnel connection connIndex=3")
			) {
				resolve("https://home-cloud.live");
			}
		});
		child.on("error", (err) => reject(err));
		child.on("close", (code) =>
			reject(new Error(`Cloudflare exited with code ${code}`)),
		);
	});
}

module.exports = { startTunnel };
