const path = require("path");
const fsSync = require("fs");
const { BASE_DIR } = require("./config");

function resolveUnderBase(userPath) {
	const p = String(userPath || "");
	return path.isAbsolute(p) ? path.resolve(p) : path.resolve(BASE_DIR, p);
}

function canonicalize(resolved) {
	try {
		return fsSync.realpathSync(resolved);
	} catch (err) {
		if (err.code !== "ENOENT") throw err;
		const suffixes = [];
		let current = resolved;
		while (current !== path.dirname(current)) {
			suffixes.unshift(path.basename(current));
			current = path.dirname(current);
			try {
				return path.join(fsSync.realpathSync(current), ...suffixes);
			} catch (err2) {
				if (err2.code !== "ENOENT") throw err2;
			}
		}
		return resolved;
	}
}

function isInsideBase(resolved) {
	let canon;
	try {
		canon = canonicalize(resolved);
	} catch {
		return false;
	}
	return canon === BASE_DIR || canon.startsWith(BASE_DIR + path.sep);
}

function jailPath(userPath) {
	const resolved = resolveUnderBase(userPath);
	if (!isInsideBase(resolved)) return null;
	try {
		return canonicalize(resolved);
	} catch {
		return null;
	}
}

module.exports = {
	BASE_DIR,
	resolveUnderBase,
	canonicalize,
	isInsideBase,
	jailPath,
};
