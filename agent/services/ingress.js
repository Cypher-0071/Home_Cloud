const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const CONFIG_PATH = path.join(
	process.env.HOME || "",
	".cloudflared",
	"config.yml",
);

function getIngressRules() {
	try {
		const file = fs.readFileSync(CONFIG_PATH, "utf8");
		const config = yaml.load(file);
		const baseDomain = process.env.CF_DOMAIN || process.env.CLOUDFLARE_BASE_DOMAIN || "home-cloud.live";
		return (config.ingress || [])
			.filter((r) => r.hostname && r.hostname !== `dash.${baseDomain}`)
			.map((r) => {
				const subdomain = r.hostname.replace(`.${baseDomain}`, "");
				const portMatch = r.service ? r.service.match(/localhost:(\d+)/) : null;
				const port = portMatch ? portMatch[1] : null;
				return {
					hostname: r.hostname,
					subdomain,
					service: r.service,
					port,
					url: `https://${r.hostname}`,
				};
			});
	} catch (e) {
		return [];
	}
}

function removeIngressByPort(localPort) {
	try {
		const file = fs.readFileSync(CONFIG_PATH, "utf8");
		const config = yaml.load(file);
		const targetService = `http://localhost:${localPort}`;
		const initialLen = config.ingress.length;
		config.ingress = config.ingress.filter((r) => r.service !== targetService);
		if (config.ingress.length !== initialLen) {
			const newYaml = yaml.dump(config, { lineWidth: -1 });
			fs.writeFileSync(CONFIG_PATH, newYaml, "utf8");
			return true;
		}
	} catch (e) {
		console.error("Failed to remove ingress rule by port:", e.message);
	}
	return false;
}

function addIngressRule(subdomain, localPort) {
	const file = fs.readFileSync(CONFIG_PATH, "utf8");
	const config = yaml.load(file);
	const baseDomain = process.env.CF_DOMAIN || process.env.CLOUDFLARE_BASE_DOMAIN || "home-cloud.live";
	const hostname = `${subdomain}.${baseDomain}`;
	if (config.ingress.some((r) => r.hostname === hostname)) {
		throw new Error("Hostname already exists");
	}
	const catchAllIndex = config.ingress.findIndex((r) => !r.hostname);
	if (catchAllIndex === -1) {
		throw new Error("Invalid config.yaml: missing catch-all fallback rule");
	}
	const newRule = {
		hostname: hostname,
		service: `http://localhost:${localPort}`,
	};
	config.ingress.splice(catchAllIndex, 0, newRule);
	const newYaml = yaml.dump(config, { lineWidth: -1 });
	fs.writeFileSync(CONFIG_PATH, newYaml, "utf8");
}

function removeIngressRule(subdomain) {
	const file = fs.readFileSync(CONFIG_PATH, "utf8");
	const config = yaml.load(file);
	const baseDomain = process.env.CF_DOMAIN || process.env.CLOUDFLARE_BASE_DOMAIN || "home-cloud.live";
	const hostname = `${subdomain}.${baseDomain}`;

	config.ingress = config.ingress.filter((r) => r.hostname !== hostname);
	const newYaml = yaml.dump(config, { lineWidth: -1 });
	fs.writeFileSync(CONFIG_PATH, newYaml, "utf8");
}

const { restartTunnel } = require("../tunnel");

function reloadCloudflared() {
	try {
		restartTunnel();
	} catch (err) {
		console.error("Failed to reload cloudflared:", err.message);
	}
}

module.exports = {
	getIngressRules,
	removeIngressByPort,
	addIngressRule,
	removeIngressRule,
	reloadCloudflared,
};
