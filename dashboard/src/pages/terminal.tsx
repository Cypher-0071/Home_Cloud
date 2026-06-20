import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export default function TerminalComponent(){
    const terminalRef = useRef<HTMLDivElement>(null)

    useEffect(()=>{
        const terminal = new Terminal()
        const fitaddon = new FitAddon()

        terminal.loadAddon(fitaddon)
        terminal.open(terminalRef.current!)
        fitaddon.fit()
        
        return () =>  terminal.dispose()
    },[])

    return <div ref={terminalRef} style={{ height: '100%', width: '100%' }} />
}