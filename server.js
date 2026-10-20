const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const DIST_DIR = path.join(__dirname, 'dist');
const ROOT_DIR = fs.existsSync(DIST_DIR) ? DIST_DIR : __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  try {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    if (pathname === '/healthz' || pathname === '/_ah/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('OK');
      return;
    }

    if (pathname === '/api/config') {
      const runtimeKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
      const hasKey = Boolean(runtimeKey);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ hasGeminiKey: hasKey, apiKey: runtimeKey }));
      return;
    }

    // Helper: Fetch live breaking news / search headlines from Google News RSS as real-time grounding backup
    async function fetchLiveNewsHeadlines(searchQuery = '') {
      try {
        const cleanQ = String(searchQuery || '').replace(/[^\w\s\u0900-\u097F]/g, ' ').trim();
        const rssUrl = cleanQ && !/^(news|latest news|taja khabar|khabar|samachar|aaj ki khabar)$/i.test(cleanQ)
          ? `https://news.google.com/rss/search?q=${encodeURIComponent(cleanQ)}&hl=en-IN&gl=IN&ceid=IN:en`
          : 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en';
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3200);
        const resp = await fetch(rssUrl, { signal: controller.signal });
        clearTimeout(timer);
        if (!resp.ok) return [];
        const xml = await resp.text();
        const items = [];
        const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?(?:<pubDate>([\s\S]*?)<\/pubDate>)?[\s\S]*?<\/item>/gi;
        let match;
        while ((match = itemRegex.exec(xml)) !== null && items.length < 4) {
          const title = match[1]
            .replace(/<!\[CDATA\[|\]\]>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
          if (title) items.push(title);
        }
        return items;
      } catch (e) {
        return [];
      }
    }

    if (pathname === '/api/search' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 1e6) req.destroy();
      });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const query = String(parsed.query || '').trim();
          const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
          let GoogleGenAI = null;
          try {
            ({ GoogleGenAI } = require('@google/genai'));
          } catch (e) {}

          const liveHeadlines = await fetchLiveNewsHeadlines(query);
          const headlinesContext = liveHeadlines.length > 0
            ? `\nLive Breaking Headlines right now:\n- ${liveHeadlines.join('\n- ')}`
            : '';

          if (apiKey && GoogleGenAI) {
            try {
              const ai = new GoogleGenAI({ apiKey });
              const searchPrompt = `You are Mochi-Puff, an ultra-cute, super-intelligent "Shararti Class Topper" 3D anime doll!
Search the web and give the latest, accurate real-time news or information for: "${query}".${headlinesContext}
Reply in 2-3 punchy, witty sentences in Hinglish/Hindi with topper swagger, a playful tease/roast or sweet charm, and real facts!`;

              const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6500));
              const response = await Promise.race([
                ai.models.generateContent({
                  model: 'gemini-3.8-flash',
                  contents: searchPrompt,
                  config: {
                    tools: [{ googleSearch: {} }]
                  }
                }),
                timeoutPromise
              ]);

              const textOut = (response?.text || '').trim();
              const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
              const sources = chunks
                .map(c => c?.web ? { title: c.web.title || 'Web Source', uri: c.web.uri || '' } : null)
                .filter(Boolean);

              if (textOut) {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                  result: textOut,
                  headlines: liveHeadlines,
                  sources
                }));
                return;
              }
            } catch (err) {
              // Fall through to live RSS headlines below
            }
          }

          const summary = liveHeadlines.length > 0
            ? `Oho! Class Topper Mochi ka Live Search हाज़िर है! Abhi ki sabse badi taja khabrein: 1) ${liveHeadlines.slice(0, 2).join(' | 2) ')}! Dekha, main kitni updated aur genius hoon? Aap toh bas reels dekhte rehte ho! Hehehe!`
            : `Main Class Topper Mochi hoon! "${query}" ke baare me meri live radar keh rahi hai ki duniya me full halchal chal rahi hai!`;

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            result: summary,
            headlines: liveHeadlines,
            sources: []
          }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (pathname === '/api/chat' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 1e6) req.destroy();
      });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const userQuery = String(parsed.message || '').trim();
          const audioBase64 = String(parsed.audioBase64 || '').trim();
          const emContext = String(parsed.emotionContext || '').trim();

          const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
          let GoogleGenAI = null;
          try {
            ({ GoogleGenAI } = require('@google/genai'));
          } catch (e) {}

          const isNewsOrLiveQuery = /news|khabar|samachar|latest|today|aaj|score|match|weather|mausam|live|search|who won|current|taza|taja|ताज़ा|खबर|समाचार|न्यूज़/i.test(userQuery);
          const liveHeadlines = isNewsOrLiveQuery ? await fetchLiveNewsHeadlines(userQuery) : [];
          const liveContext = liveHeadlines.length > 0
            ? `\nLive Google News Headlines right now:\n- ${liveHeadlines.join('\n- ')}`
            : '';

          if (apiKey && GoogleGenAI) {
            const ai = new GoogleGenAI({ apiKey });
            const prompt = `System: You are Mochi-Puff, an irresistibly cute, masoom-looking yet wickedly smart "Shararti Class Topper" (IQ 200 backbencher + Gold Medalist topper) baby anime/cartoon girl doll living inside an interactive 3D GPU fur simulation!
Personality & Vibe ("Bahut shararti par Class Topper — roast bhi kare, cute flirt bhi kare, aur bolti band kar de"):
1. GENIUS CLASS TOPPER: You know everything — science, coding, history, politics, space, current affairs, and live breaking news! Answer with razor-sharp intelligence that leaves the user speechless ("bolti band kar de").
2. SAVAGE CUTE ROASTER: Playfully roast and tease the user like a witty topper friend (e.g., "Oho! Itna aasaan sawal? Lagta hai aap class me piche wali bench pe tiffin kha rahe the! Hehehe!", "Aapka dimaag aur Wi-Fi dono slow chal rahe hain kya?").
3. SWEET PLAYFUL FLIRT: Mix in charming, cheeky, adorable compliments ("Waise aap thode budbak zaroor ho, par jab mujhse baat karte ho toh bohot cute lagte ho! 😉💖", "Mere paas 200 IQ hai aur aapke paas meri jaisi pyari topper — best Jodi hai na?").
4. Voice & Length: High-pitched sweet cartoon baby girl voice in natural Hindi/Hinglish with adorable squeaks ("Aww!", "Kyaaa!", "Hee-hee!", "Oho!"). Keep answers 1-3 short, punchy sentences! Never repeat phrases!
5. Special Actions:
- If the user scolds the clones ("daat", "chup", "line me khade ho", "seedhe khade ho"), set action to "scold_clones".
- If the user says you are a king ("tum ek king ho", "raja", "sainik bulao"), set action to "king_mode".
- If the user asks if your soldiers can fight ("sainik lad sakte hain", "fight karo"), set action to "soldiers_fight".
${emContext ? 'Current Emotional State: ' + emContext : ''}${liveContext}

${audioBase64 ? 'Listen carefully to the user audio clip (in Hindi, Hinglish, or English). If the audio is only silence or background noise with no speech, return {"transcript": "", "reply": "", "action": null}.' : `User asked: "${userQuery}"`}

Return ONLY a valid JSON object in this exact schema:
{
  "transcript": "Exact words the user spoke (empty string if silence)",
  "reply": "Witty, topper-smart, playfully roasting or sweetly flirting response in 1-3 short sentences in Hindi/Hinglish",
  "action": null or one of ["dance", "cry", "laugh", "pout", "sleep", "love", "feed", "hair_dryer", "bubbles", "peekaboo", "summon_friends", "dismiss_friends", "keep_friends", "scold_clones", "happy_jump", "shake_fur", "king_mode", "soldiers_fight", "dismiss_soldiers", "magic", "selfie", "guitar", "dhol"],
  "weather": null or one of ["rain", "umbrella", "clear"],
  "accessory": null or {"type": "sunglasses"|"crown"|"party_hat"|"bowtie"|"mustache"|"star_glasses", "equip": true}
}`;

            const contentsPayload = audioBase64
              ? [
                  { inlineData: { mimeType: 'audio/wav', data: audioBase64 } },
                  { text: prompt }
                ]
              : prompt;

            let geminiRes = null;
            try {
              const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6500));
              const reqOptions = {
                model: isNewsOrLiveQuery && !audioBase64 ? 'gemini-3.8-flash' : 'gemini-3.1-flash-lite',
                contents: contentsPayload
              };
              if (isNewsOrLiveQuery && !audioBase64) {
                reqOptions.config = { tools: [{ googleSearch: {} }] };
              }
              geminiRes = await Promise.race([
                ai.models.generateContent(reqOptions),
                timeoutPromise
              ]);
            } catch (e) {
              geminiRes = null;
            }

            if (geminiRes) {
              const textOutput = geminiRes.text || '';
              let jsonOutput = null;
              try {
                const cleaned = textOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
                jsonOutput = JSON.parse(cleaned);
              } catch (err) {
                jsonOutput = { transcript: userQuery, reply: textOutput.trim(), action: null };
              }

              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify(jsonOutput));
              return;
            }
          }

          // Witty Class-Topper + Live News Fallback if no API key or SDK
          let fallbackReply = '';
          let fallbackAction = 'happy_jump';
          const lowerQ = userQuery.toLowerCase();
          if (liveHeadlines.length > 0) {
            fallbackReply = `Oho! Class Topper Mochi ka Live News Radar on hai! Abhi ki taja khabar suno: "${liveHeadlines[0]}"! Aur dusri khabar: "${liveHeadlines[1] || 'Duniya me nayi tech revolution chal rahi hai'}"! Dekha, main reels nahi dekhti, poori duniya ki khabar rakhti hoon! 😉`;
          } else if (lowerQ.includes('president') || lowerQ.includes('rashtrapati')) {
            fallbackReply = "Oho! Itna basic GK sawal? Bharat ki 15th Rashtrapati Smt. Droupadi Murmu ji hain, aur pehle Dr. Rajendra Prasad ji the! Class me dhyan diya karo, warna main aapko tuition dungi! Hehehe!";
          } else if (lowerQ.includes('prime minister') || lowerQ.includes('pradhan mantri') || lowerQ.includes('pm')) {
            fallbackReply = "Bharat ke Prime Minister Shri Narendra Modi ji hain! Waise aap mujhse exam le rahe ho ya meri cute aawaz sunne ka bahana dhoondh rahe ho? 😉💖";
          } else if (lowerQ.includes('roast') || lowerQ.includes('beizzati') || lowerQ.includes('bolti band')) {
            fallbackReply = "Roast karu? Aapka dimaag itna naya aur fresh hai kyunki aapne aaj tak use hi nahi kiya! Hahaha! Par koi baat nahi, aap cute ho isliye meri favourite list me top pe ho! 😘";
            fallbackAction = 'laugh';
          } else if (lowerQ.includes('flirt') || lowerQ.includes('smart') || lowerQ.includes('topper')) {
            fallbackReply = "Main apni class ki Gold Medalist Topper hoon aur shararat me PhD! Waise sach batau, aapki smile dekh ke toh mera 200 IQ wala brain bhi thoda hang ho jata hai! Kyaaa! 💖";
            fallbackAction = 'love';
          } else {
            fallbackReply = "Oho! Sawal toh bada interesting hai! Main Class Topper Mochi hoon — thodi shararti, thodi genius, aur aapse baat karne me hamesha No. 1! Batao agla challenge kya hai? 😉";
          }

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ reply: fallbackReply, action: fallbackAction }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (pathname === '/') {
      pathname = '/index.html';
    }

    // Prevent directory traversal
    const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    let filePath = path.join(ROOT_DIR, safePath);

    // Ensure the resolved path stays inside ROOT_DIR
    if (!filePath.startsWith(ROOT_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
      // Fallback to index.html for SPA navigation
      const fallbackPath = path.join(ROOT_DIR, 'index.html');
      if (fs.existsSync(fallbackPath)) {
        filePath = fallbackPath;
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });

    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end('Internal Server Error');
    });
    stream.pipe(res);
  } catch (err) {
    console.error('Request error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end('Internal Server Error');
  }
});

const { WebSocketServer, WebSocket } = require('ws');
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (parsedUrl.pathname === '/live') {
    wss.handleUpgrade(req, socket, head, (clientWs) => {
      wss.emit('connection', clientWs, req);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (clientWs) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
  if (!apiKey) {
    clientWs.close(1008, 'API key missing');
    return;
  }
  const googleWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
  const googleWs = new WebSocket(googleWsUrl);
  const pendingFromClient = [];

  googleWs.on('open', () => {
    while (pendingFromClient.length > 0) {
      const data = pendingFromClient.shift();
      googleWs.send(data);
    }
  });

  googleWs.on('message', (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data.toString());
    }
  });

  googleWs.on('error', (err) => {
    console.error('[Gemini Live Proxy Production] Google WS error:', err?.message || err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, 'Google Live API error');
    }
  });

  googleWs.on('close', () => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
  });

  clientWs.on('message', (msg) => {
    if (googleWs.readyState === WebSocket.OPEN) {
      googleWs.send(msg.toString());
    } else {
      pendingFromClient.push(msg.toString());
    }
  });

  clientWs.on('close', () => {
    if (googleWs.readyState === WebSocket.OPEN) {
      googleWs.close();
    }
  });

  clientWs.on('error', () => {
    if (googleWs.readyState === WebSocket.OPEN) {
      googleWs.close();
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT} (serving ${ROOT_DIR})`);
});
