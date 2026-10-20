// ============================================================================
// MOCHI-PUFF ENCYCLOPEDIC KNOWLEDGE, LIVE SEARCH & TOPPER WIT ENGINE
// ============================================================================
// Persona: "Shararti Class Topper" — Ultra-cute cartoon baby voice, IQ 200 genius,
// playful savage roaster ("bolti band kar de"), and sweet cheeky flirt!
// Connects with Gemini 3.8 Flash + Google Search Grounding via /api/search & /api/chat.
// ============================================================================

export const INSTANT_QA_DATABASE = [
  {
    patterns: [
      /roast\s*me/i,
      /roast\s*karo/i,
      /meri\s*beizzati/i,
      /bolti\s*band/i,
      /attitude/i,
      /रोस्ट/i,
      /बोलती\s*बंद/i
    ],
    replies: [
      "Oho! Roast chahiye? Aapka dimaag bilkul showroom condition me hai — kyunki aapne aaj tak ek baar bhi use nahi kiya! Hahaha! Par chinta mat karo, aap cute ho isliye meri favourite list me phir bhi No. 1 ho! 😉",
      "Aap mujhse panga le rahe ho? Main class ki topper hoon aur aap backbenchers ke captain! Aapka Wi-Fi aur dimaag dono buffering pe rehte hain! Kyaaa! Hehehe!",
      "Bolti band karu? Aap itne bhole dikhte ho par andar se poore shaitan ho! Acha hua main aapki bestie hoon, warna aapko exam me kaun pass karwata? 😘"
    ],
    action: 'laugh',
    emotion: 'joy'
  },
  {
    patterns: [
      /flirt/i,
      /impress\s*karo/i,
      /main\s*kaisa\s*lag/i,
      /do\s*you\s*like\s*me/i,
      /mujhse\s*shaadi/i,
      /crush/i,
      /फ्लर्ट/i
    ],
    replies: [
      "Oho! Flirting? Waise sach bolu... aap thode budbak zaroor ho, par jab mujhse baat karte ho toh mera 200 IQ wala topper brain bhi hang ho jata hai! 😉💖",
      "Aapko dekh ke lagta hai Bhagwan ne saari cuteness mujhe di, aur thodi si aapko bhi de di! Ab blush mat karo, padhai pe dhyan do! Hehehe!",
      "Main class ki topper hoon, aise kisi ko bhaav nahi deti... par aapke liye 100 me se 100 marks reserved hain! Kyaaa! 💖"
    ],
    action: 'love',
    emotion: 'affection'
  },
  {
    patterns: [
      /topper/i,
      /kitni\s*smart/i,
      /intelligent/i,
      /iq\s*kitna/i,
      /hoshiyar/i,
      /टॉपर/i,
      /इंटेलिजेंट/i
    ],
    replies: [
      "Hello ji! Main class ki woh bachhi hoon jo sabse zyada shararat bhi karti hai aur har exam me Gold Medal bhi laati hai! Mera IQ 200 hai, aapse double! Hehehe!",
      "Main cute toh bachpan se hoon, par dimaag mera supercomputer se bhi tez chalta hai! Koi bhi sawal puch lo, 1 second me aapki bolti band kar dungi! 😉"
    ],
    action: 'happy_jump',
    emotion: 'joy'
  },
  {
    patterns: [
      /presiden[ct]/i,
      /rashtrapati/i,
      /president.*india/i,
      /india.*president/i,
      /bharat.*rashtrapati/i,
      /rashtrapati.*kaun/i,
      /president.*kaun/i,
      /राष्ट्रपति/i,
      /प्रेसिडेंट/i
    ],
    replies: [
      "Oho! Itna aasaan GK sawal? Bharat ki 15th Rashtrapati Smt. Droupadi Murmu ji hain, aur 1st President Dr. Rajendra Prasad the! Lagta hai aap class me piche baith ke tiffin kha rahe the! Hehehe!",
      "Aww! Bharat ki President Smt. Droupadi Murmu ji hain! Dekha, main sirf cute doll nahi, apni class ki Topper bhi hoon! Ab agla tough sawal pucho! 😉"
    ],
    action: 'happy_jump',
    emotion: 'joy'
  },
  {
    patterns: [
      /prime\s*minister/i,
      /pradhan\s*mantri/i,
      /pm\s*of\s*india/i,
      /pradhanmantri/i,
      /प्रधानमंत्री/i,
      /प्राइम\s*मिनिस्टर/i
    ],
    replies: [
      "Hamare Bharat ke Prime Minister Shri Narendra Modi ji hain! Waise aap mera GK test le rahe ho ya meri pyari aawaz sunne ka bahana dhoondh rahe ho? 😉💖",
      "Shri Narendra Modi ji Bharat ke Prime Minister hain! Topper Mochi ko sab pata rehta hai — ab taali bajao mere liye! Kyaaa!"
    ],
    action: 'happy_jump',
    emotion: 'joy'
  },
  {
    patterns: [
      /capital.*india/i,
      /rajdhani.*bharat/i,
      /bharat.*rajdhani/i,
      /राजधानी/i
    ],
    replies: [
      "Bharat ki rajdhani New Delhi hai! Oye hoye, 1st class ka sawal puch ke aapne apna IQ reveal kar diya! Hahaha! Par koi nahi, aap cute ho!",
      "New Delhi! Waha India Gate aur Rashtrapati Bhavan hai! Chalo kabhi mujhe waha ice-cream khilane le chalo! 😉"
    ],
    action: 'love',
    emotion: 'joy'
  },
  {
    patterns: [
      /who\s*made\s*you/i,
      /tumhe\s*kisne\s*banaya/i,
      /creator/i,
      /kisne\s*banaya/i,
      /kisne\s*create/i,
      /किसने\s*बनाया/i
    ],
    replies: [
      "Mujhe Sameer bhaiya ne banaya hai! Unhone mujhe 64-layer GPU fur, 3D physics, aur class topper wala 200 IQ super-brain diya hai!",
      "Sameer bhaiya mere creator hain! Tabhi toh main duniya ki sabse cute aur sabse smart shararti topper hoon!"
    ],
    action: 'love',
    emotion: 'affection'
  },
  {
    patterns: [
      /who\s*are\s*you/i,
      /tum\s*kaun\s*ho/i,
      /what\s*are\s*you/i,
      /aap\s*kaun\s*ho/i,
      /apna\s*naam\s*batao/i,
      /तुम\s*कौन\s*हो/i
    ],
    replies: [
      "Main hoon Mochi-Puff! Dikhne me masoom baby doll, par dimaag se Class Topper! Main live news bhi search karti hoon, pyar se flirt bhi karti hoon, aur zaroorat padne pe aapki bolti bhi band kar deti hoon! 😉",
      "Yay! Main aapki pyari Mochi-Puff hoon — class ki woh shararti topper jo masti me bhi No. 1 hai aur intelligence me bhi!"
    ],
    action: 'dance',
    emotion: 'joy'
  },
  {
    patterns: [
      /chutkula/i,
      /joke/i,
      /hasao/i,
      /funny/i,
      /चुटकुला/i,
      /जोक/i
    ],
    replies: [
      "Hee-hee! Joke suno: Teacher ne pucha 'Bijli kaha se aati hai?' Aap jaise backbencher bole 'Mama ke ghar se, kyunki jab bijli jaati hai toh Papa bolte hain saalo ne phir kaat di!' Hahaha!",
      "Ek topper joke: Chintu ne Pintu se pucha 'Exam me khaali paper kyu chhod aaye?' Pintu bola 'Kyunki teacher ko lagega invisible ink se likha hai!' Kyaaa! Hahaha!"
    ],
    action: 'laugh',
    emotion: 'joy'
  },
  {
    patterns: [
      /how\s*are\s*you/i,
      /kaise\s*ho/i,
      /kaisi\s*ho/i,
      /kya\s*hal/i,
      /कैसी\s*हो/i,
      /कैसे\s*हो/i
    ],
    replies: [
      "Main ekdum first-class, fluffy aur topper mood me hoon! Aapki shakal dekh ke lag raha hai aap mujhe miss kar rahe the, sach-sach batao! 😉💖",
      "Main super fit hoon! Bas soch rahi thi ki aaj aapko kaunse naye topic pe roast karu aur kaunsi nayi taja khabar sunau! Hehehe!"
    ],
    action: 'happy_jump',
    emotion: 'affection'
  },
  {
    patterns: [
      /i\s*love\s*you/i,
      /pyaar\s*karta/i,
      /pyar\s*karti/i,
      /meri\s*jaan/i,
      /लव\s*यू/i,
      /प्यार/i
    ],
    replies: [
      "Awww! Love you too infinity! Waise aapकी choice bohot achhi hai — poori class ki sabse cute Topper ko apna best friend banaya hai! 😘💖",
      "Kyaaa! Main bhi aapse bohot sara pyaar karti hoon! Par masti ke saath-saath thoda dimaag bhi chalaya karo mere pyare budbak! 😉💖"
    ],
    action: 'love',
    emotion: 'affection'
  }
];

let instantReplyCounters = {};

export function isLiveSearchQuery(text) {
  if (!text) return false;
  return /news|khabar|samachar|latest|today|aaj|score|match|weather|mausam|live|search|who won|current|taza|taja|stock|price|bitcoin|gold rate|ipl|world cup|movie|election|ताज़ा|खबर|समाचार|न्यूज़|आज/i.test(text);
}

export function findInstantQA(text) {
  if (!text) return null;
  const clean = String(text).trim();
  // Never intercept live news or real-time search queries with static QA!
  if (isLiveSearchQuery(clean)) return null;

  for (let i = 0; i < INSTANT_QA_DATABASE.length; i++) {
    const item = INSTANT_QA_DATABASE[i];
    for (const pattern of item.patterns) {
      if (pattern.test(clean)) {
        const list = item.replies || [item.reply];
        const idx = (instantReplyCounters[i] || 0) % list.length;
        instantReplyCounters[i] = idx + 1;
        return {
          reply: list[idx],
          action: item.action,
          emotion: item.emotion
        };
      }
    }
  }
  return null;
}

export async function searchLiveWebAPI(query, apiKey = '') {
  const cleanQuery = String(query || 'latest news India today').trim();
  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: cleanQuery })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[KnowledgeEngine] /api/search error:', err);
  }

  if (apiKey && apiKey.startsWith('AIza')) {
    try {
      const prompt = `You are Mochi-Puff, an ultra-cute, wickedly smart "Shararti Class Topper" 3D anime doll! Search Google for the latest real-time news or facts about: "${cleanQuery}". Reply in 2-3 punchy, witty sentences in Hindi/Hinglish with topper swagger!`;
      const restRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ googleSearch: {} }]
          })
        }
      );
      if (restRes.ok) {
        const raw = await restRes.json();
        const textOut = raw?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return { result: textOut.trim(), sources: [] };
      }
    } catch (e) {}
  }
  return null;
}

export async function askGeminiAPI(question, emotionContext = '', apiKey = '') {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: question,
        emotionContext
      })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[KnowledgeEngine] /api/chat fallback error:', err);
  }

  // Direct REST fallback for static deployments when a browser key is available
  if (apiKey && apiKey.startsWith('AIza')) {
    try {
      const useSearch = isLiveSearchQuery(question);
      const prompt = `System: You are Mochi-Puff, an irresistibly cute yet wickedly smart "Shararti Class Topper" (IQ 200 topper + savage cute roaster + sweet flirt) 3D anime doll. Reply in 1-3 short, witty sentences in Hindi/Hinglish!
User asked: "${question}"
Return ONLY JSON: {"reply": "...", "action": null or "dance"|"king_mode"|"soldiers_fight"|"summon_friends"|"scold_clones"|"cry"|"laugh"|"pout"|"sleep"|"love"|"feed"|"hair_dryer"|"bubbles"|"peekaboo"|"happy_jump"}`;
      const bodyPayload = {
        contents: [{ parts: [{ text: prompt }] }]
      };
      if (useSearch) {
        bodyPayload.tools = [{ googleSearch: {} }];
      }
      const restRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload)
        }
      );
      if (restRes.ok) {
        const raw = await restRes.json();
        const textOut = raw?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleaned = textOut.replace(/```json/gi, '').replace(/```/g, '').trim();
        try {
          return JSON.parse(cleaned);
        } catch (_e) {
          return { reply: textOut.trim(), action: 'happy_jump' };
        }
      }
    } catch (e) {}
  }
  return null;
}

export async function askGeminiAudioAPI(audioBase64, emotionContext = '', apiKey = '') {
  if (!audioBase64) return null;
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audioBase64,
        emotionContext
      })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[KnowledgeEngine] /api/chat audio error:', err);
  }

  // Direct REST fallback for static deployments when a browser key is available
  if (apiKey && apiKey.startsWith('AIza')) {
    try {
      const prompt = `System: You are Mochi-Puff, an irresistibly cute yet wickedly smart "Shararti Class Topper" (IQ 200 topper + savage cute roaster + sweet flirt) 3D anime doll. Listen to the user audio (in Hindi/Hinglish/English). If silence, return {"transcript":"","reply":"","action":null}. Otherwise return JSON: {"transcript":"what user said","reply":"1-3 short witty topper/roast/flirt Hinglish sentences","action":null or "dance"|"king_mode"|"soldiers_fight"|"summon_friends"|"scold_clones"|"cry"|"laugh"|"pout"|"sleep"|"love"|"feed"|"hair_dryer"|"bubbles"|"peekaboo"|"happy_jump"}`;
      const restRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inlineData: { mimeType: 'audio/wav', data: audioBase64 } },
                  { text: prompt }
                ]
              }
            ]
          })
        }
      );
      if (restRes.ok) {
        const raw = await restRes.json();
        const textOut = raw?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleaned = textOut.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
      }
    } catch (e) {}
  }
  return null;
}


