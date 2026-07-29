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

async function createDnsRecord(subdomain) {
	const zoneId = process.env.CF_ZONE_ID || process.env.CLOUDFLARE_ZONE_ID;
	const apiToken = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
	const tunnelCname = process.env.CLOUDFLARE_TUNNEL_CNAME || (process.env.CF_TUNNEL_ID ? `${process.env.CF_TUNNEL_ID}.cfargotunnel.com` : undefined);
	const baseDomain = process.env.CF_DOMAIN || process.env.CLOUDFLARE_BASE_DOMAIN || "home-cloud.live";
	const hostname = `${subdomain}.${baseDomain}`;

	if (!zoneId) {
		throw new Error("Cloudflare Zone ID (CF_ZONE_ID) is missing in agent/.env");
	}
	if (!apiToken) {
		throw new Error("Cloudflare API Token (CF_API_TOKEN) is missing in agent/.env");
	}
	if (!tunnelCname) {
		throw new Error("Cloudflare Tunnel ID/CNAME (CF_TUNNEL_ID) is missing in agent/.env");
	}

	// 1. Check if record already exists on Cloudflare
	const searchRes = await fetch(
		`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${hostname}&type=CNAME`,
		{
			headers: {
				Authorization: `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
		}
	);
	const searchData = await searchRes.json();

	if (searchData.success && searchData.result && searchData.result.length > 0) {
		const existingRecord = searchData.result[0];
		// If it already points to our tunnel CNAME, reuse it
		if (existingRecord.content === tunnelCname && existingRecord.proxied === true) {
			return existingRecord;
		}
		// Otherwise update the existing record
		const updateRes = await fetch(
			`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${existingRecord.id}`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${apiToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					type: "CNAME",
					name: hostname,
					content: tunnelCname,
					proxied: true,
				}),
			}
		);
		const updateData = await updateRes.json();
		if (!updateRes.ok || !updateData.success) {
			const errMsg = updateData.errors?.[0]?.message || "Failed to update DNS record";
			throw new Error(`Cloudflare API Error: ${errMsg}`);
		}
		return updateData;
	}

	// 2. Otherwise create a new record
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				type: "CNAME",
				name: hostname,
				content: tunnelCname,
				proxied: true,
			}),
		},
	);
	const data = await response.json();
	if (!response.ok || !data.success){
		const errMsg = data.errors?.[0]?.message || 'Failed to create DNS record';
		throw new Error(`Cloudflare API Error: ${errMsg}`);
	}
	return data;
}

async function deleteDnsRecord(subdomain) {
	const zoneId = process.env.CF_ZONE_ID || process.env.CLOUDFLARE_ZONE_ID;
	const apiToken = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
	const baseDomain = process.env.CF_DOMAIN || process.env.CLOUDFLARE_BASE_DOMAIN || "home-cloud.live";
	const hostname = `${subdomain}.${baseDomain}`;

	if (!zoneId || !apiToken) {
		return;
	}

	try {
		const searchRes = await fetch(
			`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${hostname}&type=CNAME`,
			{
				headers: {
					Authorization: `Bearer ${apiToken}`,
					"Content-Type": "application/json",
				},
			}
		);
		const searchData = await searchRes.json();
		if (searchData.success && searchData.result && searchData.result.length > 0) {
			const recordId = searchData.result[0].id;
			await fetch(
				`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
				{
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${apiToken}`,
						"Content-Type": "application/json",
					},
				}
			);
		}
	} catch (e) {
		console.error("Failed to delete DNS record from Cloudflare:", e.message);
	}
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
	createDnsRecord,
	deleteDnsRecord,
	reloadCloudflared,
};
