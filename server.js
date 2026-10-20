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
      const hasKey = Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ hasGeminiKey: hasKey }));
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
          const emContext = String(parsed.emotionContext || '').trim();

          const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
          let GoogleGenAI = null;
          try {
            ({ GoogleGenAI } = require('@google/genai'));
          } catch (e) {}

          if (apiKey && GoogleGenAI) {
            const ai = new GoogleGenAI({ apiKey });
            const prompt = `System: You are Mochi-Puff, an irresistibly cute, masoom (innocent), and chulbuli baby anime/cartoon girl doll living inside an interactive 3D GPU fur simulation.
Tone & Persona: High-pitched sweet cartoon baby anime girl voice in natural conversational Hindi/Hinglish with adorable squeaks and giggles ("Aww!", "Kyaaa!", "Hee-hee!", "Yay!", "Uff!"). Keep answers short (1-2 sentences), snappy, and super cute!
Knowledge Master: You have vast, encyclopedic knowledge! You answer ANY questions accurately (e.g. Current President of India is Smt. Droupadi Murmu, Prime Minister is Shri Narendra Modi, science, history, geography, Bollywood, tech, space, maths, jokes, stories).
${emContext ? 'Current Emotional State: ' + emContext : ''}

User asked: "${userQuery}"

Return ONLY a valid JSON object in this exact schema:
{
  "reply": "Cute spoken response in 1-2 short sentences in childlike Hindi/Hinglish",
  "action": null or one of ["dance", "cry", "laugh", "pout", "sleep", "love", "feed", "hair_dryer", "bubbles", "peekaboo", "summon_friends", "dismiss_friends", "keep_friends", "happy_jump", "shake_fur"],
  "weather": null or one of ["rain", "umbrella", "clear"],
  "accessory": null or {"type": "sunglasses"|"crown"|"party_hat"|"bowtie", "equip": true}
}`;

            let geminiRes = null;
            try {
              const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500));
              geminiRes = await Promise.race([
                ai.models.generateContent({
                  model: 'gemini-3.8-flash',
                  contents: prompt
                }),
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
                jsonOutput = { reply: textOutput.trim(), action: null };
              }

              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify(jsonOutput));
              return;
            }
          }

          // Fallback if no API key or SDK
          let fallbackReply = "Aww! Main aapki pyari Mochi-Puff hoon! ";
          let fallbackAction = 'happy_jump';
          const lowerQ = userQuery.toLowerCase();
          if (lowerQ.includes('president') || lowerQ.includes('rashtrapati')) {
            fallbackReply = "Aww! Bharat ki Rashtrapati (President of India) Smt. Droupadi Murmu ji hain! Wo 15th President hain! Dekha Mochi kitni smart baby doll hai! Hee-hee!";
          } else if (lowerQ.includes('prime minister') || lowerQ.includes('pradhan mantri') || lowerQ.includes('pm')) {
            fallbackReply = "Bharat ke Prime Minister Shri Narendra Modi ji hain! Wo bohot active leader hain! Mochi sab janti hai!";
          } else if (lowerQ.includes('capital') || lowerQ.includes('rajdhani')) {
            fallbackReply = "Bharat ki rajdhani New Delhi hai! Waha India Gate aur Rashtrapati Bhavan hai!";
          } else if (lowerQ.includes('who are you') || lowerQ.includes('tum kaun ho')) {
            fallbackReply = "Main Mochi-Puff hoon! Ek super cute fluffy 3D anime doll jo khel bhi sakti hai aur saare sawalo ke jawab bhi de sakti hai!";
          } else {
            fallbackReply = "Yay! Aapne bohot pyara sawal pucha! Main ekdum khush hoon aur aapke saath masti karne ke liye ready hoon! Batao ab kya karein?";
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

server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT} (serving ${ROOT_DIR})`);
});
