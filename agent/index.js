require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http");
const ws = require("ws");
const path = require("path");
const { startTunnel } = require("./tunnel");
const cookieParser = require("cookie-parser");
const auth = require("./routes/auth");
const authMiddleware = require("./middleware/auth");
const { handleSystemTerminal } = require("./sockets/terminal");
const { handleContainerExec } = require("./sockets/containerExec");

const port = 3000;
const server = http.createServer(app);
const WebSocketServer = ws.WebSocketServer;
const wss = new WebSocketServer({ server });

// Master WebSocket Router: isolates host terminal and container exec connections deterministically
wss.on("connection", (socket, request) => {
	const url = request.url || "";
	if (url.includes("/ws/docker/exec")) {
		handleContainerExec(socket, request);
	} else {
		handleSystemTerminal(socket, request);
	}
});

app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", auth);
app.use("/api", authMiddleware);
app.use("/api/metrics", require("./routes/metrics"));
app.use("/api/files", require("./routes/file"));
app.use("/api/docker", require("./routes/docker"));
app.use(express.static(path.join(__dirname, "../dashboard/dist")));

app.get("/api/health", (req, res) => {
	res.json({ status: "ok" });
});

app.get("/{*path}", (req, res) => {
	res.sendFile(path.join(__dirname, "../dashboard/dist", "index.html"));
});

server.listen(port, async () => {
	console.log(`Agent is running on port: ${port}`);
	const url = await startTunnel();
	console.log(url);
});
