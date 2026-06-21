import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export default function TerminalComponent(){
    const terminalRef = useRef<HTMLDivElement>(null)
    const socketRef = useRef<WebSocket | null>(null)

    useEffect(()=>{
        const terminal = new Terminal()
        const fitaddon = new FitAddon()
        socketRef.current = new WebSocket('wss://home-cloud.live/terminal') 
        terminal.loadAddon(fitaddon)
        terminal.open(terminalRef.current!)
        fitaddon.fit()

        socketRef.current.onmessage = (event) =>{
            terminal.write(event.data)
        }

        terminal.onData((data)=>{
            socketRef.current?.send(data)
        })
        
        
        return () =>  {
            terminal.dispose()
            socketRef.current?.close()
        }
    },[])

    return <div ref={terminalRef} style={{ height: '100%', width: '100%' }} />
}