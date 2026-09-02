require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http");
const ws = require("ws");
const path = require("path");
const { PORT } = require("./config");
const { startTunnel } = require("./tunnel");
const cookieParser = require("cookie-parser");
const auth = require("./routes/auth");
const authMiddleware = require("./middleware/auth");
const { handleSystemTerminal } = require("./sockets/terminal");
const { handleContainerExec } = require("./sockets/containerExec");

const server = http.createServer(app);
const WebSocketServer = ws.WebSocketServer;
const wss = new WebSocketServer({ server });

// Master WebSocket Router: isolates host terminal and container exec connections deterministically
wss.on("connection", (socket, request) => {
	let pathname = "";
	try {
		pathname = new URL(request.url || "", "http://localhost").pathname;
	} catch {
		socket.close();
		return;
	}
	if (pathname === "/ws/docker/exec") {
		handleContainerExec(socket, request);
	} else if (pathname === "/terminal") {
		handleSystemTerminal(socket, request);
	} else {
		socket.close();
	}
});

app.use(express.json());
app.use(cookieParser());

// Public endpoints (no auth required)
app.use("/api/auth", auth);

// Public Healthcheck & Local LAN Detection endpoint with CORS & Private Network Access support
app.all("/api/health", (req, res) => {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "*");
	res.setHeader("Access-Control-Allow-Private-Network", "true");
	if (req.method === "OPTIONS") {
		return res.sendStatus(204);
	}
	res.json({ status: "ok" });
});

// Network metadata (local IP discovery for LAN switching)
app.use("/api/network", require("./routes/network"));

// Authenticated endpoints
app.use("/api", authMiddleware);
app.use("/api/metrics", require("./routes/metrics"));
app.use("/api/files", require("./routes/file"));
app.use("/api/docker/stacks", require("./routes/stacks"));
app.use("/api/docker", require("./routes/docker"));
app.use(express.static(path.join(__dirname, "../dashboard/dist")));

app.get("/{*path}", (req, res) => {
	res.sendFile(path.join(__dirname, "../dashboard/dist", "index.html"));
});

server.listen(PORT, async () => {
	console.log(`Agent is running on port: ${PORT}`);
	const url = await startTunnel();
	console.log(url);
});
