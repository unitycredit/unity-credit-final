/* eslint-disable no-console */
const { spawn } = require('node:child_process')
const readline = require('node:readline')

const HOST = '0.0.0.0'
const PORT = '3000'

function start() {
  // Use Next's CLI entry directly so this works cross-platform without relying on `next.cmd`.
  // eslint-disable-next-line import/no-extraneous-dependencies
  const nextBin = require.resolve('next/dist/bin/next')

  const child = spawn(process.execPath, [nextBin, 'dev', '--hostname', HOST, '--port', PORT], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env,
  })

  let printed = false

  const maybePrintReady = (line) => {
    // Next 15 format: "✓ Ready in 2.4s"
    // Older expected format: "ready - started server on 0.0.0.0:3002"
    if (printed) return
    if (typeof line !== 'string') return
    if (line.includes('Ready in')) {
      printed = true
      process.stdout.write(`ready - started server on ${HOST}:${PORT}\n`)
    }
  }

  const outRl = readline.createInterface({ input: child.stdout })
  outRl.on('line', (line) => {
    process.stdout.write(`${line}\n`)
    maybePrintReady(line)
  })

  const errRl = readline.createInterface({ input: child.stderr })
  errRl.on('line', (line) => {
    process.stderr.write(`${line}\n`)
    maybePrintReady(line)
  })

  child.on('exit', (code, signal) => {
    // Preserve exit behavior
    if (signal) process.exit(1)
    process.exit(typeof code === 'number' ? code : 1)
  })
}

start()


