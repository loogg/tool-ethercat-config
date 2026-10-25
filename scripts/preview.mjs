import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, sep, extname } from 'node:path'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const port = Number(process.env.PORT || 4181)
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8' }
if (!existsSync(resolve(root, 'index.html'))) {
  console.error('未找到 dist。请先在本仓库执行 npm ci 和 npm run build。')
  process.exit(1)
}
const server = createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return }
  let file
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname)
    file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`)
    if (!file.startsWith(resolve(root) + sep) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('文件不存在'); return
    }
  } catch { res.writeHead(400); res.end('Bad request'); return }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' })
  if (req.method === 'HEAD') res.end()
  else createReadStream(file).pipe(res)
})
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已在使用。若工具已打开，请访问 http://127.0.0.1:${port}/` : error.message)
  process.exitCode = 1
})
server.listen(port, '127.0.0.1', () => console.log(`EtherCAT Atlas · http://127.0.0.1:${port}/\n仅监听本机。按 Ctrl+C 关闭。`))
