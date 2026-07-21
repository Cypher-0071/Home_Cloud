const pty = require("node-pty");
const os = require("os");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");

class PTY {
	constructor(ws) {
		this.ws = ws;
		this.shell = os.platform() === "win32" ? "powershell.exe" : "bash";
	}

	createPTY() {
		this.terminal = pty.spawn(this.shell, [], {
			name: "xterm-256color",
			cols: 100,
			cwd: process.env.HOME,
			env: process.env,
		});
		this.terminal.onData((data) => {
			if (this.ws.readyState === 1) { // WebSocket.OPEN
				this.ws.send(data);
			}
		});
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
				ptyinstance.createPTY();
				ws.on("message", (data) => {
					ptyinstance.writeTerminal(data.toString());
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
