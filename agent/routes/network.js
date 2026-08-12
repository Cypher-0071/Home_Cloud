const express = require("express");
const router = express.Router();
const os = require("os");

router.get("/info", (req, res) => {
	try {
		const ifaces = os.networkInterfaces();
		let serverLocalIp = null;

		for (const name of Object.keys(ifaces)) {
			// Skip Docker, veth, bridge, virtualbox, and VPN virtual interfaces
			if (/^(docker|veth|br-|vbox|vmnet|tun|tap)/i.test(name)) continue;

			for (const iface of ifaces[name]) {
				if (iface.family === "IPv4" && !iface.internal) {
					serverLocalIp = iface.address;
					break;
				}
			}
			if (serverLocalIp) break;
		}

		res.json({
			status: "ok",
			serverLocalIp,
			serverLocalPort: 3000,
		});
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;
