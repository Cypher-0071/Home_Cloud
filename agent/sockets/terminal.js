const pty = require('node-pty')
const os = require('os')
const path = require('path')

class PTY{
    constructor(ws){
        this.ws = ws;
        this.shell = os.platform() == 'win32'?'powershell.exe':'bash';
        
    }

    createPTY(){
        this.terminal = pty.spawn(this.shell, [], {
            name: 'xterm-256color',
            cols: 100,
            cwd : process.env.HOME,
            env :  process.env
        } )
        this.terminal.onData((data)=>{
            this.ws.send(data)
        })
    }
    getTerminal(){
      return this.terminal;
    }

    writeTerminal(data){
        if(this.terminal){
            this.terminal.write(data);
        }
    }
}

function setupTerminal(wss){
    wss.on('connection', (ws) =>{
        const ptyinstance = new PTY(ws)
        ptyinstance.createPTY()
        ws.on('message', (data)=>{
            ptyinstance.writeTerminal(data)
        })
    })
}

module.exports = {
    setupTerminal
}   