const pty = require("node-pty");
const os = require("os");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");

class PTY {
	constructor(ws) {
		this.ws = ws;
		this.shell = os.platform() === "win32" ? "powershell.exe" : (process.env.SHELL || "bash");
	}

	createPTY(cols = 100, rows = 30) {
		const isZsh = /zsh$/i.test(this.shell);
		const args = isZsh ? ["-o", "NO_PROMPT_SP", "-o", "NO_PROMPT_CR"] : [];
		this.terminal = pty.spawn(this.shell, args, {
			name: "xterm-256color",
			cols: cols || 100,
			rows: rows || 30,
			cwd: process.env.HOME || process.cwd(),
			env: {
				...process.env,
				LANG: "C.UTF-8",
				LC_ALL: "C.UTF-8",
				PROMPT_EOL_MARK: "",
			},
		});
		this.terminal.onData((data) => {
			if (this.ws.readyState === 1) { // WebSocket.OPEN
				this.ws.send(data);
			}
		});
	}

	resize(cols, rows) {
		if (this.terminal && cols > 0 && rows > 0) {
			try {
				this.terminal.resize(cols, rows);
			} catch {}
		}
	}

	writeTerminal(data) {
		if (this.terminal) {
			this.terminal.write(data);
		}
	}

	destroy() {
		if (this.terminal) {
			this.terminal.kill();
		}
	}
}

function handleSystemTerminal(ws, request) {
	const cookies = cookie.parse(request.headers.cookie || '');
	const token = cookies.token;
	if (token) {
		jwt.verify(token, process.env.JWT_SECRET, (err, decodedtoken) => {
			if (err) {
				ws.close();
				return;
			} else {
				const ptyinstance = new PTY(ws);
				let created = false;
				const ensurePTY = (cols, rows) => {
					if (!created) {
						ptyinstance.createPTY(cols, rows);
						created = true;
					}
				};
				ws.on("message", (data) => {
					const msgStr = data.toString();
					try {
						const parsed = JSON.parse(msgStr);
						if (parsed && parsed.type === "resize" && parsed.cols && parsed.rows) {
							if (!created) {
								ensurePTY(parsed.cols, parsed.rows);
							} else {
								ptyinstance.resize(parsed.cols, parsed.rows);
							}
							return;
						}
					} catch {}
					ensurePTY();
					ptyinstance.writeTerminal(msgStr);
				});
				ws.on("close", () => {
					ptyinstance.destroy();
				});
			}
		});
	} else {
		ws.close();
		return;
	}
}

module.exports = {
	handleSystemTerminal,
};
