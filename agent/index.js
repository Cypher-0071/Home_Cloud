require('dotenv').config()
const express = require('express');
const app = express();
const http = require('http');
const ws = require('ws');
const path = require('path')
const { startTunnel } = require('./tunnel')
const cookieParser = require('cookie-parser');
const auth = require('./routes/auth')
const authMiddleware = require('./middleware/auth')

const port = 3000
const server = http.createServer(app)
const WebSocketServer = ws.WebSocketServer
const wss = new WebSocketServer({server})

app.use(express.json())
app.use(cookieParser())
app.use('/api/auth', auth)
app.use(express.static(path.join(__dirname, '../dashboard/dist')))

wss.on('connection', (ws)=>{
    console.log('client connected')
})

app.get('/api/health', authMiddleware,(req, res) => {
    res.json({status: "ok"})
});

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard/dist', 'index.html'))
})

server.listen(port, async()=> {
    console.log(`Agent is running on port: ${port}`)
    const url = await startTunnel()
    console.log(url);
})