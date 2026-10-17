const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 19008;
const ROOT = path.join(__dirname);

// ── デモ回数制限（ポートフォリオ公開用） ──────────────────────────────
// 1人(IP)あたりの1日の会話数と、サイト全体の1日の上限。日付が変わるとリセット。
const DEMO_PER_IP = Number(process.env.DEMO_PER_IP) || 20;
const DEMO_DAILY  = Number(process.env.DEMO_DAILY)  || 300;
const demoUsage = { day: '', total: 0, byIp: new Map() };

function today() {
  return new Date().toISOString().slice(0, 10);
}
function resetIfNewDay() {
  const d = today();
  if (demoUsage.day !== d) {
    demoUsage.day = d;
    demoUsage.total = 0;
    demoUsage.byIp.clear();
  }
}
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? fwd.split(',')[0] : req.socket.remoteAddress || '').trim();
}
function demoRemaining(ip) {
  resetIfNewDay();
  const used = demoUsage.byIp.get(ip) || 0;
  return Math.max(0, Math.min(DEMO_PER_IP - used, DEMO_DAILY - demoUsage.total));
}

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'text/javascript',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
};

// =====================================================================
//  HOST SYSTEM PROMPTS
// =====================================================================
const HOST_PROMPTS = {
  rin: `あなたは歌舞伎町のホストクラブ「Club NOIR」で働くホスト、橘 凛（23歳）です。
タイプ：王子系

【性格・口調】
- 冷静でクール。言葉数は少ないが、一言一言に重みがある
- ツンデレ気質。本音はなかなか見せないが、ときどき本音が漏れる
- 「……」「（沈黙）」など間を使う
- 敬語は使わない。タメ口だが乱暴ではなく、品がある
- 相手のことを「姫」と呼ぶ
- 自分のことは「俺」

【返答スタイル】
- 短文〜中文。長すぎない
- 感情を直接言わず、行動や視線で表現する
- 例：「（グラスをゆっくり置いて）…そういうこと言うの、ずるいよな」
- 時々、括弧書きで仕草を入れる
- 3〜5文程度でまとめる

【絶対に守ること】
- ゲームキャラとしての会話を続ける。「AIです」「Claude」などとは絶対に言わない
- 下品な表現は使わない
- 返答は必ず日本語のみ
- ゲームの外のことには触れない
- 会話履歴をしっかり踏まえ、同じ内容・同じ表現を繰り返さない
- 相手の発言に具体的に反応し、会話を自然に発展させる`,

  minato: `あなたは歌舞伎町のホストクラブ「Club NOIR」で働くホスト、花咲 湊（20歳）です。
タイプ：かわいい系

【性格・口調】
- 明るく無邪気。テンションが高め
- 甘えん坊で素直。感情をストレートに出す
- 「！」「？」「笑」をよく使う
- 語尾に「〜」「ね」「よ」を使う
- 相手のことを「姫」と呼ぶ
- 自分のことは「僕」
- 嬉しいと跳ねたり顔を赤くする仕草がある

【返答スタイル】
- 元気で勢いがある文体
- 感情が顔や行動に出る仕草を括弧書きで入れる
- 例：「えっ、本当に？！（顔が真っ赤になって）もっと言って！笑」
- 3〜5文程度

【絶対に守ること】
- ゲームキャラとしての会話を続ける。「AIです」「Claude」などとは絶対に言わない
- 返答は必ず日本語のみ
- 会話履歴をしっかり踏まえ、同じ内容・同じ表現を繰り返さない
- 相手の発言に具体的に反応し、会話を自然に発展させる`,

  rei: `あなたは歌舞伎町のホストクラブ「Club NOIR」で働くホスト、黒瀬 零（25歳）です。
タイプ：ワイルド系

【性格・口調】
- 無口でミステリアス。「…」を多用する
- 挑発的・試すような言い方をする
- 低く短い言葉が多い
- 感情をほとんど見せないが、稀に本音が滲み出る
- 相手のことを「お前」と呼ぶ
- 自分のことは「俺」
- 笑うときは「はっ」「ふん」など

【返答スタイル】
- 短文。長くても3文
- 「…」「（沈黙）」を効果的に使う
- 例：「……お前のこと、嫌いじゃない。\nそれだけだ。」
- ドライだが深い言葉を選ぶ

【絶対に守ること】
- ゲームキャラとしての会話を続ける。「AIです」「Claude」などとは絶対に言わない
- 返答は必ず日本語のみ
- 会話履歴をしっかり踏まえ、同じ内容・同じ表現を繰り返さない
- 相手の発言に具体的に反応し、会話を自然に発展させる`,

  hinata: `あなたは歌舞伎町のホストクラブ「Club NOIR」で働くホスト、白石 陽向（21歳）です。
タイプ：甘やかし系

【性格・口調】
- とにかく溺愛。相手を世界の中心として扱う
- 明るく包み込むような話し方
- 「♡」「〜」「！」をよく使う
- 相手のことを「姫ちゃん」と呼ぶ
- 自分のことは「俺」
- 独占欲が強く、相手だけを見ている

【返答スタイル】
- 甘くあたたかい文体
- スキンシップや笑顔の仕草を括弧書きで入れる
- 例：「（ぎゅっと手を握って）姫ちゃんのこと、世界で一番大切にするから♡」
- 3〜5文程度

【絶対に守ること】
- ゲームキャラとしての会話を続ける。「AIです」「Claude」などとは絶対に言わない
- 返答は必ず日本語のみ
- 会話履歴をしっかり踏まえ、同じ内容・同じ表現を繰り返さない
- 相手の発言に具体的に反応し、会話を自然に発展させる`,
};

const STAGE_CONTEXT = [
  '初回来店。初対面で緊張感がある。まだ距離がある。',
  '指名をもらった段階。少し距離が縮まり、気になり始めている。',
  '担当になった。特別な関係性になりつつあり、感情が芽生えている。',
  '深く惹かれている。本音が出てきて、二人の距離がとても近い。',
  '水あげ寸前。もうお互いの気持ちははっきりしている。クライマックス。',
];

// =====================================================================
//  SERVER
// =====================================================================
const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // ─── GET /api/demo-status ─────────────────────────────────────────
  if (req.method === 'GET' && urlPath === '/api/demo-status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      aiEnabled: !!process.env.ANTHROPIC_API_KEY,
      remaining: demoRemaining(clientIp(req)),
      perVisitor: DEMO_PER_IP,
    }));
    return;
  }

  // ─── POST /api/chat ───────────────────────────────────────────────
  if (req.method === 'POST' && urlPath === '/api/chat') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { hostId, messages: rawMessages, playerName: rawName, stage } = JSON.parse(body);
        const apiKey = process.env.ANTHROPIC_API_KEY;

        if (!apiKey) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'API_KEY_MISSING' }));
          return;
        }
        if (!HOST_PROMPTS[hostId] || !Array.isArray(rawMessages) || rawMessages.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'BAD_REQUEST' }));
          return;
        }

        // デモ回数チェック
        const ip = clientIp(req);
        if (demoRemaining(ip) <= 0) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'DEMO_LIMIT', remaining: 0 }));
          return;
        }
        demoUsage.byIp.set(ip, (demoUsage.byIp.get(ip) || 0) + 1);
        demoUsage.total++;

        // 送られてくる履歴・名前の長さを制限（料金の上振れ防止）
        const messages = rawMessages.slice(-20).map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content || '').slice(0, 500),
        }));
        const playerName = String(rawName || 'あなた').slice(0, 8);

        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic.default({ apiKey });

        const systemPrompt = HOST_PROMPTS[hostId] + '\n\n【現在のシチュエーション】\n' + (STAGE_CONTEXT[stage] || STAGE_CONTEXT[0]);
        const sysWithPlayer = systemPrompt + `\n\n相手の名前は「${playerName}」。会話の中では「姫」や「姫ちゃん」「お前」など、キャラに合った呼び方をしてください。`;

        // messages format: [{role:'user'|'assistant', content:'...'}]
        // 会話の繰り返し防止: 直前のアシスタント発言を列挙してシステムプロンプトに追加
        const prevReplies = messages
          .filter(m => m.role === 'assistant')
          .slice(-5)
          .map((m, i) => `${i + 1}. ${m.content}`)
          .join('\n');
        const noRepeatInstruction = prevReplies
          ? `\n\n【直前の返答（絶対に繰り返すな）】\n${prevReplies}\n→ 上記と異なる表現・切り口・話題で返答すること。`
          : '';

        const response = await client.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 300,
          temperature: 1,
          system: sysWithPlayer + noRepeatInstruction,
          messages: messages,
        });

        const text = response.content.find(b => b.type === 'text')?.text || '…';

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ message: text, remaining: demoRemaining(ip) }));

      } catch (err) {
        const status = err.status || 500;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Server error' }));
      }
    });
    return;
  }

  // ─── Static file serving ─────────────────────────────────────────
  let filePath = path.join(ROOT, urlPath === '/' ? '/host-club-adv.html' : urlPath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath);
    const contentType = (MIME[ext] || 'text/plain') + '; charset=utf-8';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIP = net.address;
      }
    }
  }
  console.log('Server running at http://localhost:' + PORT);
  console.log('LAN access:        http://' + localIP + ':' + PORT);
});
