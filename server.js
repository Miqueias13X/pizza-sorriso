// Servidor de pedidos da Pizza Sorriso
// Recebe o pedido do app e envia para o Telegram do dono.
// Variáveis de ambiente (configuradas no painel do Render):
//   TELEGRAM_TOKEN    -> token do bot (gerado no BotFather)
//   TELEGRAM_CHAT_ID  -> código do chat do dono (use /descobrir-chat para achar)
//   ALLOWED_ORIGIN    -> (opcional) site que pode enviar pedidos, ex: https://seusite.com

const http = require('http');

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

function enviarCors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function responder(res, status, obj) {
  enviarCors(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

async function telegram(metodo, corpo) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${metodo}`, {
    method: corpo ? 'POST' : 'GET',
    headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  return r.json();
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    enviarCors(res);
    res.writeHead(204);
    return res.end();
  }

  // Descobrir o código do chat: o dono envia /start para o bot e acessa esta rota
  if (req.method === 'GET' && req.url === '/descobrir-chat') {
    if (!TOKEN) return responder(res, 500, { erro: 'TELEGRAM_TOKEN não configurado' });
    telegram('getUpdates')
      .then(d => {
        const chats = (d.result || [])
          .map(u => u.message && u.message.chat)
          .filter(Boolean)
          .map(c => ({ id: c.id, nome: c.first_name || c.title || c.username }));
        responder(res, 200, { chats });
      })
      .catch(e => responder(res, 500, { erro: String(e) }));
    return;
  }

  if (req.method === 'POST' && req.url === '/pedido') {
    let corpo = '';
    req.on('data', parte => { corpo += parte; if (corpo.length > 20000) req.destroy(); });
    req.on('end', async () => {
      try {
        if (!TOKEN || !CHAT_ID) {
          return responder(res, 500, { erro: 'Servidor sem TELEGRAM_TOKEN ou TELEGRAM_CHAT_ID' });
        }
        const { mensagem } = JSON.parse(corpo || '{}');
        if (!mensagem || typeof mensagem !== 'string') {
          return responder(res, 400, { erro: 'Mensagem vazia' });
        }
        const d = await telegram('sendMessage', { chat_id: CHAT_ID, text: mensagem });
        if (!d.ok) return responder(res, 502, { erro: d.description || 'Falha no Telegram' });
        responder(res, 200, { ok: true });
      } catch (e) {
        responder(res, 500, { erro: String(e) });
      }
    });
    return;
  }

  responder(res, 404, { erro: 'Não encontrado' });
});

server.listen(PORT, () => console.log('Servidor de pedidos na porta ' + PORT));
