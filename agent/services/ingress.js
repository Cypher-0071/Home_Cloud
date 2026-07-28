const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const {execSync} = require("child_process");
const { error } = require("console");

const CONFIG_PATH = path.join(
	process.env.HOME || "",
	".cloudflared",
	"config.yml",
);

function addIngressRule(subdomain, localPort) {
	const file = fs.readFileSync(CONFIG_PATH, "utf8");
	const config = yaml.load(file);
	const hostname = `${subdomain}.${process.env.CLOUDFLARE_BASE_DOMAIN || "home-cloud.live"}`;
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
	const hostname = `${subdomain}.${process.env.CLOUDFLARE_BASE_DOMAIN || "home-cloud.live"}`;

	config.ingress = config.ingress.filter((r) => r.hostname !== hostname);
	const newYaml = yaml.dump(config, { lineWidth: -1 });
	fs.writeFileSync(CONFIG_PATH, newYaml, "utf8");
}

async function createDnsRecord(subdomain) {
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/dns_records`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				type: "CNAME",
				name: subdomain,
				content: process.env.CLOUDFLARE_TUNNEL_CNAME,
				proxied: true,
			}),
		},
	);
    const data = await response.json();
    if (!response.ok || !data.success){
        const errMsg = data.errors?.[0]?.message || 'Failed to create DNS record';
        throw new Error(`Cloudflare API Error: ${errMsg}`);
    }
    return data
}

function reloadCloudflared(){
    try {
        execSync("pkill -HUP cloudflared")
    } catch (err) {
        console.error("Failed to reload cloudflared:", err.message);
    }
}

module.exports = {
	addIngressRule,
	removeIngressRule,
    createDnsRecord,
    reloadCloudflared
};
