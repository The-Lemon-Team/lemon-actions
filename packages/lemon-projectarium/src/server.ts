import * as http from 'http';
import { ProjectariumEngine } from './engine/projectarium.engine';

const engine = new ProjectariumEngine();
const PORT = Number(process.env.PORT || 4320);

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // JSON helper
  const sendJson = (statusCode: number, data: any) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data, null, 2));
  };

  // Body parser helper
  const readBody = (callback: (body: any) => void) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        const parsed = raw ? JSON.parse(raw) : {};
        callback(parsed);
      } catch (err: any) {
        sendJson(400, { error: 'Invalid JSON payload', message: err.message });
      }
    });
  };

  // 1. Healthcheck
  if (pathname === '/health' || pathname === '/api/health') {
    sendJson(200, { status: 'UP', service: 'Lemon-Projectarium Standalone Engine', port: PORT });
    return;
  }

  // 2. Stats
  if (pathname === '/api/projectarium/stats' && req.method === 'GET') {
    sendJson(200, engine.getStats());
    return;
  }

  // 3. Projects List
  if (pathname === '/api/projectarium/projects' && req.method === 'GET') {
    sendJson(200, engine.listProjects());
    return;
  }

  // 4. Smart Upsert Registration
  if (pathname === '/api/projectarium/register' && req.method === 'POST') {
    readBody((body) => {
      const result = engine.registerOrAttach(body);
      sendJson(200, result);
    });
    return;
  }

  // 5. HTML Dashboard
  if (pathname === '/' || pathname === '/dashboard') {
    const stats = engine.getStats();
    const projects = engine.listProjects();

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Lemon-Projectarium Standalone Cockpit</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .hud { display: flex; align-items: center; justify-content: space-between; background: #1e293b; padding: 16px 24px; border-radius: 16px; border: 1px solid #334155; margin-bottom: 24px; }
    .badge { background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: bold; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 20px; }
    .card h3 { margin: 0 0 8px 0; color: #38bdf8; }
    .token { font-family: monospace; font-size: 11px; background: #0f172a; padding: 4px 8px; border-radius: 6px; color: #94a3b8; display: inline-block; margin-bottom: 12px; }
    .app-item { background: #0f172a; padding: 10px 14px; border-radius: 10px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
    .port { font-family: monospace; font-weight: bold; color: #34d399; }
  </style>
</head>
<body>
  <div class="hud">
    <div>
      <h2 style="margin: 0;">🍋 Lemon-Projectarium Standalone Cockpit</h2>
      <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 13px;">Dedicated Port: :${PORT} • Zero-Deadlock Anchors Protected</p>
    </div>
    <div style="display: flex; gap: 16px; align-items: center;">
      <span class="badge">Zero-Deadlock Active</span>
      <div style="font-family: monospace; font-size: 13px;">Стенды: <b>${stats.totalProjects}</b> | Портов: <b>${stats.totalApps}</b></div>
    </div>
  </div>
  <div class="grid">
    ${projects
      .map(
        (p) => `
      <div class="card">
        <h3>${p.name}</h3>
        <div class="token">Token: ${p.projectToken} • Workspace: ${p.neuronWorkspace}</div>
        <p style="font-size: 12px; color: #cbd5e1; margin-bottom: 16px;">${p.context?.description || 'Инфраструктурный стенд'}</p>
        <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px;">Сервисы (${p.apps.length}):</div>
        ${p.apps
          .map(
            (a) => `
          <div class="app-item">
            <div>
              <div style="font-weight: bold; font-size: 12px;">${a.appName}</div>
              <div style="font-size: 10px; color: #64748b;">${a.networkMode} • ${a.status}</div>
            </div>
            <div class="port">:${a.port}</div>
          </div>
        `,
          )
          .join('')}
      </div>
    `,
      )
      .join('')}
  </div>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  sendJson(404, { error: 'Not Found', path: pathname });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Lemon-Projectarium] Standalone server running on http://localhost:${PORT}`);
  console.log(`[Lemon-Projectarium] REST API available at http://localhost:${PORT}/api/projectarium`);
  console.log(`[Lemon-Projectarium] Web Dashboard: http://localhost:${PORT}/dashboard`);
});
