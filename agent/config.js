const os = require("os");
const path = require("path");
const fs = require("fs");

const PORT = Number(process.env.PORT) || 3000;

const rawBase = process.env.BASE_DIR || os.homedir();
const BASE_DIR = fs.realpathSync(path.resolve(rawBase));

const CF_DOMAIN =
	process.env.CF_DOMAIN ||
	process.env.CLOUDFLARE_BASE_DOMAIN ||
	"home-cloud.live";

const TUNNEL_NAME = process.env.TUNNEL_NAME || "home-cloud";

const CF_CONFIG =
	process.env.CF_CONFIG ||
	path.join(os.homedir(), ".cloudflared", "config.yml");

const COOKIE_SECURE = process.env.COOKIE_SECURE !== "false";

module.exports = {
	PORT,
	BASE_DIR,
	CF_DOMAIN,
	TUNNEL_NAME,
	CF_CONFIG,
	COOKIE_SECURE,
};
