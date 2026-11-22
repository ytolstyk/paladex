// Runs under Electron (not Node): renders an SVG to a 1024x1024 transparent PNG.
//   electron scripts/render-icon.cjs <in.svg> <out.png>
const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync } = require('node:fs')
const { resolve } = require('node:path')

const SIZE = 1024
const [input, output] = process.argv.slice(-2).map((p) => resolve(p))

app.disableHardwareAcceleration()
app
  .whenReady()
  .then(async () => {
    const svg = readFileSync(input, 'utf8')
    const win = new BrowserWindow({
      width: SIZE,
      height: SIZE,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      useContentSize: true,
      webPreferences: { offscreen: true, sandbox: true }
    })
    const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block;width:${SIZE}px;height:${SIZE}px}</style>${svg}`
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    await new Promise((done) => setTimeout(done, 400)) // let filters and gradients paint
    const image = await win.webContents.capturePage()
    const exact = image.getSize().width === SIZE ? image : image.resize({ width: SIZE, height: SIZE, quality: 'best' })
    writeFileSync(output, exact.toPNG())
    app.quit()
  })
  .catch((err) => {
    console.error(err)
    app.exit(1) // never hang the caller
  })
