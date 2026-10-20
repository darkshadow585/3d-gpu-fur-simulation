import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

function apiPlugin(apiKey: string) {
  return {
    name: 'mochi-api-server',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const parsedUrl = new URL(req.url || '/', 'http://localhost:3000');
        if (parsedUrl.pathname === '/api/config') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ hasGeminiKey: Boolean(apiKey) }));
          return;
        }
        if (parsedUrl.pathname === '/api/chat' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', async () => {
            try {
              const parsed = JSON.parse(body || '{}');
              const userQuery = String(parsed.message || '').trim();
              const emContext = String(parsed.emotionContext || '').trim();

              let GoogleGenAI: any = null;
              try {
                const genaiMod = await import('@google/genai');
                GoogleGenAI = genaiMod.GoogleGenAI;
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

                let geminiRes: any = null;
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

                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(jsonOutput));
                  return;
                }
              }

              // Fallback
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

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ reply: fallbackReply, action: fallbackAction }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';

  return {
    plugins: [react(), apiPlugin(apiKey)],
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          grass: resolve(__dirname, 'grass.html'),
        },
      },
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
      'process.env.VITE_GEMINI_API_KEY': JSON.stringify(apiKey),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(apiKey),
      'import.meta.env.GEMINI_API_KEY': JSON.stringify(apiKey),
      __GEMINI_API_KEY__: JSON.stringify(apiKey),
    },
  };
});

