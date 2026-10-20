// ============================================================================
// MOCHI-PUFF ENCYCLOPEDIC KNOWLEDGE & CONVERSATION ENGINE ("Gyani Mochi")
// ============================================================================
// Answers ANY questions (General Knowledge, Science, India, History, Riddles,
// Jokes, Feelings, Stories) in signature ultra-cute, high-pitched cartoon baby voice.
// Seamlessly connects with Gemini 3.8 Flash via /api/chat and instant offline QA.
// ============================================================================

export const INSTANT_QA_DATABASE = [
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
    reply: "Aww! Mujhe pata hai! Bharat ki Rashtrapati (President of India) Smt. Droupadi Murmu ji hain! Wo India ki 15th President hain aur bohot inspiring hain! Aur pehle rashtrapati Dr. Rajendra Prasad the! Dekha Mochi kitni smart baby doll hai! Hee-hee!",
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
    reply: "Hamare pyare Bharat ke Prime Minister (Pradhan Mantri) Shri Narendra Modi ji hain! Wo bohot active aur popular leader hain! Mochi sab janti hai!",
    action: 'happy_jump',
    emotion: 'joy'
  },
  {
    patterns: [
      /capital.*india/i,
      /rajdhani.*bharat/i,
      /bharat.*rajdhani/i,
      /delhi/i,
      /राजधानी/i
    ],
    reply: "Bharat ki rajdhani (Capital of India) New Delhi hai! Waha India Gate, Red Fort aur Rashtrapati Bhavan hai! Mujhe ghumna bohot pasand hai!",
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
    reply: "Mujhe Sameer bhaiya ne banaya hai! Unhone mujhe 64-layer GPU fur, 3D physics aur ek super intelligent cartoon baby doll ka pyara brain diya hai!",
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
    reply: "Yay! Main hoon aapki pyari Mochi-Puff! Ek fluffy, chulbuli 3D anime doll jo khel-kood bhi karti hai aur duniya ke saare sawalo ke accurate jawab bhi deti hai!",
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
    reply: "Hee-hee! Ek chutkula suno: Ek baar Chintu ne Pintu se pucha - 'Mochi itni gol-matol kyu hai?' Pintu bola - 'Kyunki usne 3 strawberry cake chupke se kha liye!' Hahaha! Kyaaa!",
    action: 'laugh',
    emotion: 'joy'
  },
  {
    patterns: [
      /kahani/i,
      /story/i,
      /katha/i,
      /कहानी/i
    ],
    reply: "Ek baar ek chhota sa gulabi cloud asman me udte-udte gir gaya aur wo ek cute fluffy Mochi ban gaya! Phir usne aapko apna sabse achha dost bana liya! Cute na?",
    action: 'love',
    emotion: 'affection'
  },
  {
    patterns: [
      /suraj/i,
      /sun\s*kya/i,
      /solar\s*system/i,
      /सूरज/i,
      /sun/i
    ],
    reply: "Suraj hamare solar system ka sabse bada sitara (star) hai jo bohot garam hai aur hume roshni aur warmth deta hai! Bina suraj ke life possible nahi hoti!",
    action: 'happy_jump',
    emotion: 'joy'
  },
  {
    patterns: [
      /chand/i,
      /moon/i,
      /chanda/i,
      /चाँद/i,
      /चंदा/i
    ],
    reply: "Chanda mama hamari Earth ka natural satellite hai! Chand ke paas apni roshni nahi hoti, wo suraj ki roshni reflect karta hai!",
    action: 'sleep',
    emotion: 'joy'
  },
  {
    patterns: [
      /largest\s*animal/i,
      /sabse\s*bada\s*janwar/i,
      /blue\s*whale/i,
      /जानवर/i
    ],
    reply: "Duniya ka sabse bada janwar Blue Whale hai! Uski lambai 100 feet tak hoti hai aur uska dil ek car jitna bada hota hai! Wow!",
    action: 'happy_jump',
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
    reply: "Main ekdum fit, fluffy aur masti ke full mood me hoon! Aapke saath baat karke mera dil baagh-baagh ho gaya! Aap batao aap kaise ho?",
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
    reply: "Awww! Main bhi aapse bohot bohot bohot sara pyaar karti hoon! Aap mere best friend ho! Love you infinity! Kyaaa!",
    action: 'love',
    emotion: 'affection'
  }
];

export function findInstantQA(text) {
  if (!text) return null;
  const clean = String(text).trim();
  for (const item of INSTANT_QA_DATABASE) {
    for (const pattern of item.patterns) {
      if (pattern.test(clean)) {
        return item;
      }
    }
  }
  return null;
}

export async function askGeminiAPI(question, emotionContext = '') {
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
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('[KnowledgeEngine] /api/chat fallback error:', err);
    return null;
  }
}
