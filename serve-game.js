const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 19008;
const ROOT = path.join(__dirname);

// ── 購入済みセッション管理 ──────────────────────────────────────────
// token → { remaining: number }
const gameSessions = new Map();

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlPath = req.url.split('?')[0];
  const urlQuery = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');

  // ─── POST /api/create-checkout ────────────────────────────────────
  if (req.method === 'POST' && urlPath === '/api/create-checkout') {
    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Stripe not configured' }));
        return;
      }
      const Stripe = require('stripe');
      const stripe = Stripe(stripeKey);
      const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'jpy',
            product_data: { name: '20会話チケット — 担当ホストを水あげするまで' },
            unit_amount: 100,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${baseUrl}/host-club-adv.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/host-club-adv.html`,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url: session.url }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ─── GET /api/verify-session ──────────────────────────────────────
  if (req.method === 'GET' && urlPath === '/api/verify-session') {
    try {
      const stripeSessionId = urlQuery.get('session_id');
      if (!stripeSessionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing session_id' }));
        return;
      }
      const Stripe = require('stripe');
      const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
      if (session.payment_status !== 'paid') {
        res.writeHead(402, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payment not completed' }));
        return;
      }
      const token = generateToken();
      gameSessions.set(token, { remaining: 20 });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token, remaining: 20 }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ─── GET /api/session-info ────────────────────────────────────────
  if (req.method === 'GET' && urlPath === '/api/session-info') {
    const token = req.headers['x-session-token'];
    const session = token ? gameSessions.get(token) : null;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ remaining: session ? session.remaining : 0 }));
    return;
  }

  // ─── POST /api/chat ───────────────────────────────────────────────
  if (req.method === 'POST' && urlPath === '/api/chat') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { hostId, messages, playerName, stage } = JSON.parse(body);
        const apiKey = req.headers['x-api-key'] || process.env.ANTHROPIC_API_KEY;

        if (!apiKey) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'API_KEY_MISSING' }));
          return;
        }

        // セッショントークンチェック（Anthropic管理者キーは除く）
        if (!req.headers['x-api-key']) {
          const sessionToken = req.headers['x-session-token'];
          if (sessionToken) {
            // 購入済みセッションの場合: 残数をチェックして消費
            const gameSession = gameSessions.get(sessionToken);
            if (!gameSession || gameSession.remaining <= 0) {
              res.writeHead(402, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'PAYMENT_REQUIRED' }));
              return;
            }
            gameSession.remaining--;
          }
          // セッショントークンなし = 無料会話（クライアント側で残数管理）
        }

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
        res.end(JSON.stringify({ message: text }));

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
