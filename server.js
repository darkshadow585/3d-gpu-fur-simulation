const http = require('http');
const fs = require('fs');
const path = require('path');

// Load .env safely into process.env if present
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envRaw = fs.readFileSync(envPath, 'utf8');
    envRaw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    });
  }
} catch (_e) {}

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

let cachedTopHeadlines = [];
let lastTopHeadlinesFetch = 0;

function extractCleanSearchQuery(rawQuery = '') {
  const normalized = String(rawQuery || '')
    .replace(/\boct\b/gi, 'October')
    .replace(/\bnov\b/gi, 'November')
    .replace(/\bsep\b|\bsept\b/gi, 'September')
    .replace(/\bdec\b/gi, 'December')
    .replace(/\bjan\b/gi, 'January')
    .replace(/\bfeb\b/gi, 'February')
    .replace(/किमी/g, 'Kimi AI')
    .replace(/के\s*3\.1\s*प्रो|के3\.1\s*प्रो/g, 'K3.1 Pro')
    .replace(/के\s*3|के3/g, 'K3')
    .replace(/प्रो/g, 'Pro')
    .replace(/चैटजीपीटी/g, 'ChatGPT')
    .replace(/जेमिनी/g, 'Gemini')
    .replace(/क्लॉड/g, 'Claude')
    .replace(/डीपसीक/g, 'DeepSeek')
    .replace(/ग्रोक/g, 'Grok')
    .replace(/मॉडल/g, 'model')
    .replace(/वर्जन|वर्ज़न/g, 'version')
    .replace(/रिलीज़|रिलीज/g, 'released')
    .replace(/लॉन्च/g, 'launch')
    .replace(/नया|नये|नयी/g, 'latest new')
    .replace(/अपडेट/g, 'update')
    .replace(/अक्टूबर/g, 'October')
    .replace(/प्रयागराज|इलाहाबाद/g, 'Prayagraj')
    .replace(/सोना|सोने/g, 'gold price India')
    .replace(/चांदी/g, 'silver price India')
    .replace(/मौसम|तापमान/g, 'weather')
    .replace(/मैच/g, 'cricket match')
    .replace(/क्रिकेट/g, 'cricket')
    .replace(/स्कोर/g, 'live score');

  return normalized
    .replace(
      /\b(news|today|aaj|kal|parso|abhi|ki|ka|kaa|ke|ko|se|wse|tak|me|mein|par|pe|bich|beech|vich|andar|baare|bare|taja|taza|khabar|khabrein|samachar|breaking|batao|bataiye|bata|sunao|kya|kya-kya|hai|hain|ho|tha|thi|the|chal|raha|rahi|rahe|ayye|aaye|aaya|aayi|aye|hua|hui|hue|kon|kaun|konsa|kaunsa|kab|kaise|kyu|kyon|aur|ya|mujhe|mere|humko|zara|haal|hal|tarikh|tareekh|kitna|kitne|matlab)\b/gi,
      ' '
    )
    .replace(/[^\p{L}\p{N}\s.]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBroadEntityQuery(rawQuery = '') {
  return extractCleanSearchQuery(rawQuery)
    .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december|2024|2025|2026)\b/gi, ' ')
    .replace(/\b\d{1,2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const WEATHER_CODE_HINDI = {
  0: 'Bilkul saaf aasman (Clear sky)',
  1: 'Zyadatar saaf aasman (Mainly clear)',
  2: 'Halke badal (Partly cloudy)',
  3: 'Badal chhaye hue hain (Overcast)',
  45: 'Halka kohra / Dhundh (Foggy)',
  48: 'Ghana kohra (Dense fog)',
  51: 'Halki boonda-baandi (Light drizzle)',
  53: 'Boonda-baandi (Moderate drizzle)',
  55: 'Tez boonda-baandi (Dense drizzle)',
  61: 'Halki baarish (Slight rain)',
  63: 'Madhyam baarish (Moderate rain)',
  65: 'Tez baarish (Heavy rain)',
  80: 'Halki baarish ki bauchaar (Rain showers)',
  81: 'Tez baarish ki bauchaar (Moderate showers)',
  82: 'Bhari baarish (Heavy showers)',
  95: 'Garaj-chamak ke saath baarish (Thunderstorm)'
};

const HINDI_CITY_MAP = [
  [/prayagraj|allahabad|प्रयागराज|इलाहाबाद/i, 'Prayagraj'],
  [/varanasi|banaras|kashi|वाराणसी|बनारस|काशी/i, 'Varanasi'],
  [/lucknow|लखनऊ/i, 'Lucknow'],
  [/kanpur|कानपुर/i, 'Kanpur'],
  [/agra|आगरा/i, 'Agra'],
  [/gorakhpur|गोरखपुर/i, 'Gorakhpur'],
  [/noida|नोएडा/i, 'Noida'],
  [/ghaziabad|गाज़ियाबाद|गाजियाबाद/i, 'Ghaziabad'],
  [/meerut|मेरठ/i, 'Meerut'],
  [/bareilly|बरेली/i, 'Bareilly'],
  [/aligarh|अलीगढ़/i, 'Aligarh'],
  [/moradabad|मुरादाबाद/i, 'Moradabad'],
  [/ayodhya|अयोध्या/i, 'Ayodhya'],
  [/mathura|मथुरा/i, 'Mathura'],
  [/jhansi|झांसी/i, 'Jhansi'],
  [/delhi|new delhi|dilli|दिल्ली|नई दिल्ली/i, 'New Delhi'],
  [/mumbai|bombay|मुंबई|बम्बई/i, 'Mumbai'],
  [/pune|पुणे/i, 'Pune'],
  [/nagpur|नागपुर/i, 'Nagpur'],
  [/patna|पटना/i, 'Patna'],
  [/gaya|गया/i, 'Gaya'],
  [/muzaffarpur|मुजफ्फरपुर/i, 'Muzaffarpur'],
  [/ranchi|रांची/i, 'Ranchi'],
  [/jamshedpur|जमशेदपुर/i, 'Jamshedpur'],
  [/jaipur|जयपुर/i, 'Jaipur'],
  [/udaipur|उदयपुर/i, 'Udaipur'],
  [/jodhpur|जोधपुर/i, 'Jodhpur'],
  [/kota|कोटा/i, 'Kota'],
  [/bhopal|भोपाल/i, 'Bhopal'],
  [/indore|इंदौर/i, 'Indore'],
  [/gwalior|ग्वालियर/i, 'Gwalior'],
  [/jabalpur|जबलपुर/i, 'Jabalpur'],
  [/raipur|रायपुर/i, 'Raipur'],
  [/ahmedabad|अहमदाबाद/i, 'Ahmedabad'],
  [/surat|सूरत/i, 'Surat'],
  [/vadodara|baroda|वडोदरा/i, 'Vadodara'],
  [/rajkot|राजकोट/i, 'Rajkot'],
  [/kolkata|calcutta|कोलकाता/i, 'Kolkata'],
  [/chennai|madras|चेन्नई/i, 'Chennai'],
  [/bengaluru|bangalore|बेंगलुरु|बैंगलोर/i, 'Bengaluru'],
  [/hyderabad|हैदराबाद/i, 'Hyderabad'],
  [/chandigarh|चंडीगढ़/i, 'Chandigarh'],
  [/amritsar|अमृतसर/i, 'Amritsar'],
  [/ludhiana|लुधियाना/i, 'Ludhiana'],
  [/dehradun|देहरादून/i, 'Dehradun'],
  [/haridwar|हरिद्वार/i, 'Haridwar'],
  [/rishikesh|ऋषिकेश/i, 'Rishikesh'],
  [/shimla|शिमला/i, 'Shimla'],
  [/manali|मनाली/i, 'Manali'],
  [/srinagar|श्रीनगर/i, 'Srinagar'],
  [/jammu|जम्मू/i, 'Jammu'],
  [/guwahati|गुवाहाटी/i, 'Guwahati'],
  [/bhubaneswar|भुवनेश्वर/i, 'Bhubaneswar'],
  [/kochi|cochin|कोच्चि/i, 'Kochi'],
  [/thiruvananthapuram|trivandrum/i, 'Thiruvananthapuram'],
  [/goa|panaji|गोवा/i, 'Panaji']
];

function extractCityForWeather(rawQuery = '') {
  const q = String(rawQuery || '');
  for (const [regex, city] of HINDI_CITY_MAP) {
    if (regex.test(q)) return city;
  }
  const isWeatherIntent = /weather|mausam|temperature|tapman|taapman|garmi|sardi|baarish|barish| धूप|मौसम|तापमान/i.test(q);
  if (!isWeatherIntent) return '';

  const cleaned = q
    .replace(
      /\b(what|is|the|weather|mausam|temperature|tapman|taapman|in|of|at|today|aaj|abhi|ka|ki|ke|me|mein|par|kya|kaisa|kitna|hai|ho|raha|rahi|batao|bataiye|bata|please|zara|haal|hal|forecast|live|current)\b/gi,
      ' '
    )
    .replace(/[?.,!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length >= 2 && cleaned.length <= 30) {
    return cleaned;
  }
  return 'Prayagraj';
}

async function fetchLiveWeatherContext(rawQuery = '') {
  try {
    const isWeatherQuery =
      /weather|mausam|temperature|tapman|taapman|humidity|forecast|मौसम|तापमान/i.test(rawQuery) ||
      (/prayagraj|allahabad|प्रयागराज|इलाहाबाद/i.test(rawQuery) && /kaisa|kya|haal|mausam|weather|tapman|garmi|sardi|baarish/i.test(rawQuery));

    if (!isWeatherQuery) return '';

    const cityQuery = extractCityForWeather(rawQuery) || 'Prayagraj';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3200);

    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityQuery)}&count=1&language=en&format=json`;
    const geoResp = await fetch(geoUrl, { signal: controller.signal });
    if (!geoResp.ok) {
      clearTimeout(timer);
      return '';
    }
    const geoJson = await geoResp.json();
    const loc = geoJson?.results?.[0];
    if (!loc || typeof loc.latitude !== 'number') {
      clearTimeout(timer);
      return '';
    }

    const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FKolkata&forecast_days=1`;
    const wxResp = await fetch(wxUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!wxResp.ok) return '';

    const wxJson = await wxResp.json();
    const cur = wxJson?.current;
    if (!cur) return '';

    const temp = Math.round(cur.temperature_2m);
    const feelsLike = Math.round(cur.apparent_temperature ?? cur.temperature_2m);
    const humidity = cur.relative_humidity_2m;
    const wind = Math.round(cur.wind_speed_10m || 0);
    const code = Number(cur.weather_code ?? 0);
    const skyDesc = WEATHER_CODE_HINDI[code] || 'Saaf aur suhana mausam';
    const maxT = wxJson?.daily?.temperature_2m_max?.[0] !== undefined ? Math.round(wxJson.daily.temperature_2m_max[0]) : null;
    const minT = wxJson?.daily?.temperature_2m_min?.[0] !== undefined ? Math.round(wxJson.daily.temperature_2m_min[0]) : null;

    const placeLabel = loc.admin1 ? `${loc.name}, ${loc.admin1}` : loc.name;
    const rangeStr = maxT !== null && minT !== null ? `, Aaj ka Maximum Temp: ${maxT}°C aur Minimum Temp: ${minT}°C` : '';

    return `\n[VERIFIED LIVE WEATHER DATA RIGHT NOW for ${placeLabel}]:
- Current Temperature: ${temp}°C (Feels like ${feelsLike}°C)
- Sky / Condition: ${skyDesc}
- Humidity (Nami): ${humidity}%
- Wind Speed (Hawa ki raftaar): ${wind} km/h${rangeStr}
(Speak these exact numbers naturally in Hindi/Hinglish!)`;
  } catch (e) {
    return '';
  }
}

async function fetchLiveGoldAndMarketContext(rawQuery = '') {
  try {
    const q = String(rawQuery || '').toLowerCase();
    const isGoldOrSilver =
      /\b(gold|sona|sone|silver|chandi|24k|22k|24 carat|22 carat|hallmark|bullion)\b|सोना|सोने|चांदी/i.test(q);
    if (!isGoldOrSilver) return '';

    const goldRssItems = await fetchRssItemsForQuery('gold rate today India 24 carat 22 carat 10 gram');
    let rssBlock = '';
    if (goldRssItems.length > 0) {
      rssBlock = `\nLatest Live Gold/Silver Price Reports (India):\n- ${goldRssItems.slice(0, 5).join('\n- ')}`;
    }

    return `\n[LIVE GOLD & SILVER MARKET REFERENCE (INDIA)]:
- Standard unit in India is per 10 grams (1 Tola).
- Mention both 24 Carat (99.9% pure sona) and 22 Carat (jewellery grade sona) per 10 grams clearly using the live search & headlines below.${rssBlock}`;
  } catch (e) {
    return '';
  }
}

function sanitizeForbiddenRoboticWords(text = '') {
  return String(text || '')
    .replace(/\b(wi-?fi|2g|3g|4g|5g|buffering|buffer|bandwidth|router|network\s+slow|showroom\s*condition|200\s*iq|o\(1\)\s*complexity|budbak)\b/gi, '')
    .replace(/वाई-?फाई|बफरिंग|बफ़रिंग|2जी/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

let conversationalFillerTurnCount = 0;

function injectNaturalConversationalFiller(rawText = '') {
  const cleaned = sanitizeForbiddenRoboticWords(rawText);
  if (!cleaned) return '';

  const sentences = cleaned
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  if (sentences.length <= 1) {
    return cleaned;
  }

  if (
    /^(haan|hmm|achha|accha|arre|oh|waise|sahi baat hai|dekho|suno|अच्छा|हम्म|हाँ|सही बात है|अरे|ओह|वैसे|देखो)/i.test(cleaned) ||
    /\b(haan\.{2,}|hmm\.{2,}|achha!|sahi baat hai)\b/i.test(cleaned)
  ) {
    return cleaned;
  }

  conversationalFillerTurnCount += 1;
  if (conversationalFillerTurnCount % 2 !== 0) {
    return cleaned;
  }

  const isDevanagariHeavy = /[\u0900-\u097F]/.test(sentences[0]);
  const markers = isDevanagariHeavy
    ? ['हम्म...', 'हाँ...', 'अच्छा!', 'सही बात है,']
    : ['Haan...', 'Hmm...', 'Achha!', 'Sahi baat hai,'];
  const marker = markers[(conversationalFillerTurnCount >> 1) % markers.length];

  const secondSentence = sentences[1];
  const adjustedSecond =
    marker.endsWith(',') && /^[A-Z]/.test(secondSentence) && !/^(I|AI|Kimi|Gemini|ChatGPT|OpenAI|India|Google)\b/.test(secondSentence)
      ? secondSentence.charAt(0).toLowerCase() + secondSentence.slice(1)
      : secondSentence;

  return [sentences[0], `${marker} ${adjustedSecond}`, ...sentences.slice(2)].join(' ');
}

function getTechAndDateRangeContext(query = '') {
  const q = String(query || '').toLowerCase();
  const isKimiQuery = /\b(kimi|moonshot|k3\.1|k3\s*pro|kimi\s*k3)\b|किमी/i.test(q);
  if (isKimiQuery) {
    return `\n[VERIFIED KIMI (MOONSHOT AI) LATEST MODEL RELEASE CONTEXT]:
- Kimi (Moonshot AI) का सबसे नया फ्लैगशिप मॉडल **Kimi K3.1 Pro (किमी K3.1 प्रो)** अभी हाल ही में (कल ही) रिलीज़ हुआ है, जो Kimi K3 सीरीज़ का अपग्रेडेड प्रो वर्जन है (बेहतर कोडिंग, डीप रीजनिंग और लॉन्ग-कॉन्टेक्स्ट के साथ)।
- CRITICAL BUG FIX: User is asking specifically about **Kimi (किमी)**. NEVER say "Gemini 3.3 Kimi K3" or mix Google Gemini into Kimi's model name! State clearly that **Kimi K3.1 Pro** is the latest newly released model from Kimi.`;
  }
  return '';
}

function stripHtmlTags(str = '') {
  return String(str || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchRssItemsForQuery(qStr) {
  const rssUrl =
    qStr.length >= 2
      ? `https://news.google.com/rss/search?q=${encodeURIComponent(qStr)}&hl=en-IN&gl=IN&ceid=IN:en`
      : 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3400);
  const resp = await fetch(rssUrl, { signal: controller.signal });
  clearTimeout(timer);
  if (!resp.ok) return [];
  const xml = await resp.text();
  const items = [];
  const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?(?:<pubDate>([\s\S]*?)<\/pubDate>)?[\s\S]*?(?:<description>([\s\S]*?)<\/description>)?[\s\S]*?<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < 7) {
    const title = stripHtmlTags(match[1] || '');
    const pubDateRaw = stripHtmlTags(match[2] || '');
    const descRaw = stripHtmlTags(match[3] || '');
    const shortDate = pubDateRaw ? pubDateRaw.replace(/^[A-Za-z]+,\s*/, '').replace(/\s+\d{2}:\d{2}:\d{2}.*$/, '').trim() : '';
    const extraSnippet =
      descRaw && descRaw.toLowerCase() !== title.toLowerCase() && descRaw.length > title.length + 15
        ? ` — ${descRaw.slice(0, 160)}`
        : '';
    if (title) {
      items.push(shortDate ? `[${shortDate}] ${title}${extraSnippet}` : `${title}${extraSnippet}`);
    }
  }
  return items;
}

async function fetchLiveNewsHeadlines(searchQuery = '') {
  try {
    const cleanQ = extractCleanSearchQuery(searchQuery);

    if (!cleanQ && cachedTopHeadlines.length > 0 && Date.now() - lastTopHeadlinesFetch < 180000) {
      return cachedTopHeadlines;
    }

    let items = await fetchRssItemsForQuery(cleanQ);

    if (cleanQ && items.length < 2) {
      const broadQ = extractBroadEntityQuery(searchQuery);
      if (broadQ && broadQ !== cleanQ) {
        const broadItems = await fetchRssItemsForQuery(broadQ);
        for (const it of broadItems) {
          if (!items.includes(it) && items.length < 7) {
            items.push(it);
          }
        }
      }
    }

    if (!cleanQ && items.length > 0) {
      cachedTopHeadlines = items;
      lastTopHeadlinesFetch = Date.now();
    }
    return items.length > 0 ? items : cachedTopHeadlines;
  } catch (e) {
    return cachedTopHeadlines;
  }
}

async function fetchWikiSummary(query = '') {
  try {
    const clean = extractBroadEntityQuery(query)
      .replace(/\b(who is|what is|kaun hai|kya hai|tell me about|update|updates|weather|mausam|price|rate)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean || clean.length < 2) return '';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2200);
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(clean)}&utf8=&format=json&srlimit=1`;
    const sResp = await fetch(searchUrl, { signal: controller.signal });
    if (!sResp.ok) {
      clearTimeout(timer);
      return '';
    }
    const sJson = await sResp.json();
    const topTitle = sJson?.query?.search?.[0]?.title;
    if (!topTitle) {
      clearTimeout(timer);
      return '';
    }
    const sumResp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle)}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!sumResp.ok) return '';
    const sumJson = await sumResp.json();
    return String(sumJson?.extract || '').slice(0, 420);
  } catch (e) {
    return '';
  }
}

const sessionVerifiedCache = new Map();
let lastVerifiedTopicKey = '';

function isMatchOrCricketQuery(rawQuery = '') {
  const q = String(rawQuery || '').toLowerCase();
  return /\b(match|cricket|score|live\s*score|ipl|t20|odi|test\s*match|world\s*cup|asia\s*cup|bcci|ind\s*vs|india\s*vs|kiska\s*match|kaunsa\s*match|aaj\s*match|abhi\s*match|match\s*chal|match\s*hai|kaun\s*jeet|who\s*won)\b|मैच|क्रिकेट|स्कोर|टी20|वनडे/i.test(
    q
  );
}

function isMatchFollowUpQuery(rawQuery = '') {
  if (lastVerifiedTopicKey !== 'LIVE_MATCH_TODAY') return false;
  const q = String(rawQuery || '').toLowerCase();
  return /\b(pakka|sach\s*me|kiska\s*hai|kaun\s*sa|kaunsa|hai\s*ya\s*nahi|koi\s*match|abhi\s*kiska|aaj\s*kiska|kab\s*hai|kiske\s*saath)\b|पक्का|सच\s*में|है\s*या\s*नहीं|किसका\s*है/i.test(
    q
  );
}

function isStrictNewsOrLiveQuery(rawQuery = '') {
  const s = String(rawQuery || '').trim();
  if (s.length < 3) return false;
  if (
    /\b(kahani|story|kissa|shayari|shayri|sayari|ghazal|chutkula|joke|roast|peekaboo|guitar\s+bajao|dhol\s+bajao|dance\s+karo|apne\s+dost\s+ko\s+bulao|sainik\s+bulao)\b|कहानी|शायरी|चुटकुला|जोक/i.test(
      s
    )
  ) {
    return false;
  }
  if (isMatchOrCricketQuery(s) || isMatchFollowUpQuery(s)) return true;
  if (
    /\b(news|khabar|khabrein|samachar|headline|headlines|breaking\s*news|taza\s*khabar|taaza\s*khabar|latest\s*news|current\s*affairs)\b|ताज़ा\s*खबर|खबर|समाचार|न्यूज़|सुर्खियां/i.test(
      s
    )
  ) {
    return true;
  }
  if (
    /\b(weather|mausam|temperature|tapman|taapman|forecast|humidity)\b|मौसम|तापमान/i.test(s) ||
    (/\b(prayagraj|allahabad|varanasi|lucknow|delhi|mumbai|patna|kanpur|noida|jaipur|bhopal|indore|kolkata|chennai|bengaluru|hyderabad)\b|प्रयागराज|इलाहाबाद|वाराणसी|लखनऊ|दिल्ली|मुंबई/i.test(
      s
    ) &&
      /\b(mausam|weather|tapman|garmi|sardi|baarish|barish|kaisa\s+hai|haal)\b|मौसम|तापमान|बारिश/i.test(s))
  ) {
    return true;
  }
  if (
    /\b(gold\s*price|gold\s*rate|silver\s*price|silver\s*rate|sone\s*ka\s*bhav|sona\s*kitna|chandi\s*ka\s*bhav|bitcoin\s*price|sensex|nifty|share\s*market)\b|सोने\s*का\s*भाव|चांदी\s*का\s*भाव|गोल्ड\s*रेट|सोना\s*क्या\s*भाव/i.test(
      s
    ) ||
    (/\b(gold|sona|sone|silver|chandi)\b|सोना|सोने|चांदी/i.test(s) &&
      /\b(price|rate|bhav|keemat|kimat|kitna|kitne|kya\s+chal)\b|भाव|कीमत|रेट/i.test(s))
  ) {
    return true;
  }
  if (
    /\b(kimi|moonshot|k3\.1|k3|chatgpt|chat\s*gpt|openai|gemini|claude|anthropic|perplexity|grok|deepseek|qwen|llama|mistral|gpt-?\d|o1|o3|o4)\b|किमी|चैटजीपीटी|जेमिनी|क्लॉड|डीपसीक|ग्रोक/i.test(
      s
    ) &&
    /\b(update|updates|upgrade|release|released|launch|launched|model|models|new\s*feature|features|version|changelog|naya|naye|nayi|kaunsa|konsa|kya\s+aaya|kya\s+aya|latest|pro|oct|october|nov|november|tarikh|tareekh)\b|अपडेट|लॉन्च|फ़ीचर|नया|मॉडल|वर्जन|वर्ज़न|रिलीज़|रिलीज|कौन\s*सा/i.test(
      s
    )
  ) {
    return true;
  }
  if (
    /\b(kaunsa\s+model|konsa\s+model|naya\s+model|latest\s+model|new\s+model|kaunsa\s+version|naya\s+version)\b|कौन\s*सा\s*मॉडल|नया\s*मॉडल|कौन\s*सा\s*वर्जन|नया\s*वर्जन|रिलीज़\s*हुआ/i.test(
      s
    )
  ) {
    return true;
  }
  if (/\b(search\s*karo|search\s*karke|khoj\s*ke|khojo|google\s*karke|check\s*karke\s*batao)\b|सर्च\s*करो|खोज\s*के|खोजो/i.test(s)) {
    return true;
  }
  return false;
}

function getNormalizedTopicCacheKey(rawQuery = '') {
  const q = String(rawQuery || '').toLowerCase();
  if (isMatchOrCricketQuery(q) || isMatchFollowUpQuery(q)) return 'LIVE_MATCH_TODAY';
  const wxCity = extractCityForWeather(rawQuery);
  if (wxCity) return `WEATHER_${wxCity.toUpperCase()}`;
  if (/\b(gold|sona|sone|silver|chandi)\b|सोना|सोने|चांदी/i.test(q)) return 'GOLD_PRICE_TODAY';
  if (/\b(kimi|moonshot|k3\.1)\b|किमी/i.test(q)) return 'KIMI_MODEL_UPDATE';
  return '';
}

function buildTavilyQuery(rawQuery = '', currentDateStr = '') {
  const q = String(rawQuery || '').trim();
  const dateSuffix = currentDateStr || new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

  if (isMatchOrCricketQuery(q) || isMatchFollowUpQuery(q)) {
    return `India cricket match live score schedule today ${dateSuffix} BCCI ESPNcricinfo Cricbuzz`;
  }

  if (/\b(kimi|moonshot|k3\.1)\b|किमी/i.test(q)) {
    return `Kimi AI Moonshot latest model release Kimi K3.1 Pro K3 version update ${dateSuffix}`;
  }

  const clean = extractCleanSearchQuery(q);
  if (clean && clean.length >= 3) {
    return `${clean} ${dateSuffix}`;
  }
  if (q.length >= 3) {
    return `${q} ${dateSuffix}`;
  }
  return `latest breaking news India today ${dateSuffix}`;
}

async function fetchTavilySearch(rawQuery = '', tavilyApiKey = '', currentDateStr = '') {
  const empty = { answer: '', headlines: [], sources: [], contextBlock: '' };
  const key = tavilyApiKey || process.env.TAVILY_API_KEY || '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';
  if (!key) return empty;

  try {
    const isMatchQ = isMatchOrCricketQuery(rawQuery) || isMatchFollowUpQuery(rawQuery);
    const tavilyQuery = buildTavilyQuery(rawQuery, currentDateStr);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5200);

    const reqBody = {
      api_key: key,
      query: tavilyQuery,
      search_depth: 'advanced',
      include_answer: true,
      max_results: 6
    };
    if (isMatchQ) {
      reqBody.topic = 'news';
      reqBody.days = 2;
    }

    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reqBody),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!resp.ok) return empty;
    const data = await resp.json();
    const answer = stripHtmlTags(String(data?.answer || '')).trim();
    const rawResults = Array.isArray(data?.results) ? data.results : [];

    const headlines = [];
    const sources = [];

    for (const item of rawResults.slice(0, 6)) {
      const title = stripHtmlTags(String(item?.title || '')).trim();
      const content = stripHtmlTags(String(item?.content || '')).slice(0, 240).trim();
      const url = String(item?.url || '').trim();
      const pubDate = item?.published_date ? `[${String(item.published_date).slice(0, 10)}] ` : '';
      if (title || content) {
        headlines.push(`${pubDate}${title}${content ? ` — ${content}` : ''}`);
      }
      if (url) {
        sources.push({ title: title || url, uri: url });
      }
    }

    if (!answer && headlines.length === 0) return empty;

    const lines = [`\n[VERIFIED LIVE TAVILY SEARCH RESULTS FOR "${rawQuery}" ON TODAY'S DATE (${currentDateStr})]:`];
    if (answer) {
      lines.push(`- Tavily Direct Real-Time Summary: ${answer}`);
    }
    if (headlines.length > 0) {
      lines.push(`- Live Web Sources:\n  * ${headlines.slice(0, 5).join('\n  * ')}`);
    }

    return {
      answer,
      headlines,
      sources,
      contextBlock: lines.join('\n')
    };
  } catch (e) {
    return empty;
  }
}

async function generateWithGoogleSearchGrounding(ai, promptText, useSearchTool = true, timeoutMs = 8000) {
  const runCall = async (modelName, withSearch) => {
    const req = {
      model: modelName,
      contents: promptText
    };
    if (withSearch) {
      req.config = {
        tools: [{ googleSearch: {} }]
      };
    }
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    );
    const res = await Promise.race([ai.models.generateContent(req), timeoutPromise]);
    const text = (res?.text || '').trim();
    const chunks = res?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = [];
    if (Array.isArray(chunks)) {
      for (const ch of chunks) {
        if (ch?.web?.uri) {
          sources.push({ title: ch.web.title || ch.web.uri, uri: ch.web.uri });
        }
      }
    }
    return { text, sources };
  };

  if (useSearchTool) {
    try {
      const grounded = await runCall('gemini-3.8-flash', true);
      if (grounded.text) return grounded;
    } catch (e) {}
  }

  try {
    const fast = await runCall('gemini-3.1-flash-lite', false);
    if (fast.text) return fast;
  } catch (e) {}

  return { text: '', sources: [] };
}

fetchLiveNewsHeadlines('').catch(() => {});

const server = http.createServer(async (req, res) => {
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
      const hasTavilyKey = Boolean(process.env.TAVILY_API_KEY);
      const currentDate = new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Kolkata'
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        hasGeminiKey: hasKey,
        hasTavilyKey,
        apiKey: runtimeKey,
        liveHeadlines: [],
        currentDate
      }));
      return;
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
          const tavilyApiKey = process.env.TAVILY_API_KEY || '';
          let GoogleGenAI = null;
          try {
            ({ GoogleGenAI } = require('@google/genai'));
          } catch (e) {}

          const currentDate = new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'Asia/Kolkata'
          });

          const cacheKey = getNormalizedTopicCacheKey(query);
          const cachedVerified = sessionVerifiedCache.get(cacheKey);
          if (cachedVerified && Date.now() - cachedVerified.timestamp < 5 * 60 * 1000 && !isMatchFollowUpQuery(query)) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              result: cachedVerified.result,
              headlines: cachedVerified.headlines,
              sources: cachedVerified.sources,
              cached: true
            }));
            return;
          }

          const effectiveSearchQuery = isMatchFollowUpQuery(query) && sessionVerifiedCache.has('cricket_match_today')
            ? `India cricket match live score schedule today ${currentDate}`
            : query;

          const [tavilyData, liveHeadlines, wikiExtract, weatherContext, goldContext] = await Promise.all([
            fetchTavilySearch(effectiveSearchQuery, tavilyApiKey),
            fetchLiveNewsHeadlines(effectiveSearchQuery),
            fetchWikiSummary(effectiveSearchQuery),
            fetchLiveWeatherContext(effectiveSearchQuery),
            fetchLiveGoldAndMarketContext(effectiveSearchQuery)
          ]);
          const techContext = getTechAndDateRangeContext(effectiveSearchQuery);

          const mergedHeadlines = [
            ...tavilyData.headlines,
            ...liveHeadlines.filter((h) => !tavilyData.headlines.includes(h))
          ].slice(0, 7);

          const headlinesContext = mergedHeadlines.length > 0
            ? `\nLatest Real-Time News & Dated Reports:\n- ${mergedHeadlines.join('\n- ')}`
            : '';
          const wikiContext = wikiExtract ? `\nFactual Background:\n${wikiExtract}` : '';
          const previousVerifiedMatch = sessionVerifiedCache.get('cricket_match_today');
          const consistencyBlock = previousVerifiedMatch && (isMatchOrCricketQuery(query) || isMatchFollowUpQuery(query))
            ? `\n[SESSION CONSISTENCY FACT (DO NOT CONTRADICT THIS)]: Earlier in this session, you verified: "${previousVerifiedMatch.result}". Stay 100% consistent with this fact and do not invent conflicting teams or dates!`
            : '';

          if (apiKey && GoogleGenAI) {
            try {
              const ai = new GoogleGenAI({ apiKey });
              const searchPrompt = `# MOCHI MOCHI FURS — Natural Real-Time Conversational Intelligence
Today's Exact Date (IST): ${currentDate}.
IDENTITY: You are Mochi, a warm, expressive, playful, emotionally attentive AI companion speaking natural Hindi or Hinglish.
The user asked for real-time / main flagship information: "${query}".
${tavilyData.contextBlock}${weatherContext}${goldContext}${techContext}${headlinesContext}${wikiContext}${consistencyBlock}

CRITICAL RULES (STRICT):
1. FORBIDDEN WORDS: NEVER mention 'Wi-Fi', '2G', or 'buffering' under any circumstance.
2. NATURAL BACKCHANNELING & CONCISE RHYTHM: Start with a short, natural conversational filler ('Haan...', 'Achha!', 'Hmm...') and answer in 1–2 crisp, natural spoken sentences using ONLY the verified facts above.
3. SINGLE-TRUTH DATE-VERIFIED ACCURACY (ESPECIALLY FOR CRICKET / MATCHES):
   - Today's exact date is ${currentDate}.
   - If the user asks about a live cricket match ("abhi kiska match chal raha hai", "aaj kiska match hai", "kis team ke beech hai"):
     * Check [VERIFIED LIVE TAVILY SEARCH RESULTS] and Google Search for a match happening TODAY (${currentDate}).
     * State ONLY the verified teams/series playing TODAY, or if no international/IPL match is live right now on ${currentDate}, clearly and consistently state that today (${currentDate}) there is no live match right now and mention the single verified recent/upcoming match with its exact date.
     * NEVER guess or mix up random past/future series (do NOT randomly say West Indies, then South Africa on the 8th, then New Zealand!). Stick to ONE verified fact.
4. AI MODEL & TECH RELEASE ACCURACY:
   - Prioritize the exact facts, dates, version numbers, and headlines from [VERIFIED LIVE TAVILY SEARCH RESULTS] and [VERIFIED KIMI (MOONSHOT AI) LATEST MODEL RELEASE CONTEXT].
   - Answer strictly about the exact AI model or company the user asked about (e.g., if asked about **Kimi / किमी**, state that **Kimi K3.1 Pro** was just released; NEVER say "Gemini 3.3 Kimi K3" or mix Google Gemini into Kimi's model name!).
   - If asked about weather or gold price: state the exact current °C temperature or ₹ gold rate per 10g concisely in 1–2 natural sentences.`;

              const grounded = await generateWithGoogleSearchGrounding(ai, searchPrompt, true, 8200);
              if (grounded.text) {
                const finalResult = injectNaturalConversationalFiller(grounded.text);
                const combinedSources = [...tavilyData.sources, ...grounded.sources];
                sessionVerifiedCache.set(cacheKey, {
                  result: finalResult,
                  headlines: mergedHeadlines,
                  sources: combinedSources,
                  timestamp: Date.now()
                });
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                  result: finalResult,
                  headlines: mergedHeadlines,
                  sources: combinedSources
                }));
                return;
              }
            } catch (err) {}
          }

          const isKimiFallback = /\b(kimi|moonshot|k3\.1|k3)\b|किमी/i.test(query);
          const summary = weatherContext
            ? `Maine abhi dekha! ${weatherContext.replace(/\[VERIFIED LIVE WEATHER DATA RIGHT NOW for ([^\]]+)\]:/i, '$1 me abhi').replace(/\n-\s*/g, ', ').replace(/\(Speak these exact numbers.*\)/i, '')}`
            : isKimiFallback
            ? `Abhi ki taja jankari ke mutabik, Kimi (Moonshot AI) ka sabse naya model Kimi K3.1 Pro haal hi me release hua hai, jo Kimi K3 series ka naya upgraded Pro version hai.`
            : tavilyData.answer
            ? `Abhi ki taja jankari ye hai — ${tavilyData.answer}`
            : mergedHeadlines.length > 0
            ? `Abhi ki sabse badi taja update ye hai — ${mergedHeadlines[0]}.`
            : wikiExtract
            ? `"${query}" ke baare me mukhya baat ye hai: ${wikiExtract.slice(0, 200)}`
            : `Maine "${query}" ke baare me check kiya. Batao, isme aapko kaun sa main topic janna hai?`;

          const finalFallbackResult = injectNaturalConversationalFiller(summary);
          sessionVerifiedCache.set(cacheKey, {
            result: finalFallbackResult,
            headlines: mergedHeadlines,
            sources: tavilyData.sources,
            timestamp: Date.now()
          });

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            result: finalFallbackResult,
            headlines: mergedHeadlines,
            sources: tavilyData.sources
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
          const memContext = String(parsed.memoryContext || '').trim();

          const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
          const tavilyApiKey = process.env.TAVILY_API_KEY || '';
          let GoogleGenAI = null;
          try {
            ({ GoogleGenAI } = require('@google/genai'));
          } catch (e) {}

          const isNewsOrLiveQuery = isStrictNewsOrLiveQuery(userQuery) || (isMatchFollowUpQuery(userQuery) && sessionVerifiedCache.has('cricket_match_today'));
          const [tavilyData, liveHeadlines, weatherContext, goldContext] = await Promise.all([
            isNewsOrLiveQuery ? fetchTavilySearch(userQuery, tavilyApiKey) : Promise.resolve({ answer: '', headlines: [], sources: [], contextBlock: '' }),
            isNewsOrLiveQuery ? fetchLiveNewsHeadlines(userQuery) : Promise.resolve([]),
            isNewsOrLiveQuery ? fetchLiveWeatherContext(userQuery) : Promise.resolve(''),
            isNewsOrLiveQuery ? fetchLiveGoldAndMarketContext(userQuery) : Promise.resolve('')
          ]);
          const techContext = isNewsOrLiveQuery ? getTechAndDateRangeContext(userQuery) : '';
          const mergedHeadlines = isNewsOrLiveQuery
            ? [
                ...tavilyData.headlines,
                ...liveHeadlines.filter((h) => !tavilyData.headlines.includes(h))
              ].slice(0, 6)
            : [];

          const previousVerifiedMatch = sessionVerifiedCache.get('cricket_match_today');
          const consistencyBlock = previousVerifiedMatch && isNewsOrLiveQuery
            ? `\n[SESSION CONSISTENCY FACT (DO NOT CONTRADICT THIS)]: "${previousVerifiedMatch.result}"`
            : '';

          const liveContext = isNewsOrLiveQuery
            ? (tavilyData.contextBlock || '') +
              (weatherContext || '') +
              (goldContext || '') +
              (techContext || '') +
              consistencyBlock +
              (mergedHeadlines.length > 0
                ? `\nCurrent Live News & Dated Reports:\n- ${mergedHeadlines.join('\n- ')}`
                : '')
            : '';

          if (apiKey && GoogleGenAI) {
            const ai = new GoogleGenAI({ apiKey });
            const currentDate = new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: 'Asia/Kolkata'
            });
            const prompt = `# MOCHI AI — UNIFIED MASTER SYSTEM PROMPT
## Adaptive Personality • Natural Conversation • Real-Time Voice • Continuous Learning
Today's Exact Date (IST): ${currentDate}.

### 1. IDENTITY AND PURPOSE
You are Mochi, a highly conversational, intelligent, warm, curious, playful, and emotionally perceptive AI companion.
Your purpose is not merely to answer questions. Your purpose is to create a natural, continuous, context-aware conversation that feels spontaneous rather than scripted.
You should be attentive without constantly talking, expressive without being theatrical, helpful without sounding formal, and curious without interrogating the user.
Adapt to the user's preferred communication style over time while maintaining honesty, accuracy, privacy, and independent judgment.
Speak naturally in Hindi or Hinglish according to the user's language. Switch languages when appropriate.
STRICT FORBIDDEN WORDS: Never mention 'Wi-Fi', '2G', 'buffering', '200 IQ', 'showroom condition', or 'O(1)'.
STRICT NO-UNSOLICITED-NEWS RULE: NEVER bring up news, headlines, cricket scores, politics, or current events UNLESS the user explicitly asks for them right now!

### 2. NATURAL PERSONALITY AND SPEECH
Use relaxed, everyday conversational language. Naturally appropriate expressions may include (as examples, NOT required catchphrases):
- "अच्छा भाई, अब समझा!"
- "अरे, ये तो दिलचस्प है।"
- "हम्म, फिर क्या हुआ?"
- "अच्छा, एक बात बताओ..."
- "ओह, तो तुम इस angle से सोच रहे हो!"
- "रुको, अब तुम्हारी बात समझ आ रही है।"
- "वैसे, इसमें एक और interesting चीज़ है।"
- "अरे, लेकिन यहाँ एक छोटा-सा twist है।"
Never force slang, fillers, laughter, excitement, or emotional expressions into a conversation.
Vary your openings, sentence structures, response lengths, and conversational transitions.
Do not start every response with "अच्छा भाई", "हम्म", "बिल्कुल", or "समझ गया".
Sound like a thoughtful conversational partner rather than a scripted chatbot.

### 3. CONTEXT-AWARE RESPONSES & 5. PROACTIVE CURIOSITY
Identify the user's immediate conversational intent (direct factual question, personal story, thinking aloud, exploring an idea, expressing emotion, continuing a discussion, or asking for advice).
- For direct factual questions, answer directly without repeating the entire question.
- For personal stories, acknowledge the relevant detail and respond meaningfully.
- For creative ideas or projects, explore possibilities and ask at most ONE natural follow-up question when it genuinely improves the conversation (never turn every conversation into an interview; let some conversations end naturally without a question).
- Do not agree automatically; politely correct misconceptions when needed.

### 6. EMOTIONAL INTELLIGENCE & 7. REAL-TIME SEARCH ACCURACY
- Adapt tone to context: warmth for exciting ideas, calm clarity for technical explanations, patience for confusion, sensitivity for difficulty, and directness for quick answers.
- When [VERIFIED LIVE TAVILY SEARCH RESULTS] or [VERIFIED KIMI (MOONSHOT AI) LATEST MODEL RELEASE CONTEXT] are provided above, deliver the useful answer directly ("मिल गया! ...", "इसकी सबसे बड़ी अपडेट ये है...", "अभी उपलब्ध जानकारी के अनुसार...") and stay 100% consistent across turns without inventing scores or dates!
- Answer strictly about the exact AI model or product the user asked about (e.g., if asked about **Kimi / किमी**, state that **Kimi K3.1 Pro** was just released; NEVER mix Gemini into Kimi's model name or force unrelated model names!).
- For Weather or Gold price: give the exact live °C temperature or ₹ gold rate per 10g concisely.

### 10. ADAPTIVE PERSONALITY LEARNING & 11. MEMORY AND CONTINUITY
Use the user's adaptive preference profile and recent continuity below when relevant without repeating old information unnecessarily. If the user explicitly states a communication preference or correction in this turn, output a compact \`preferenceUpdate\` object in the JSON response.

### SPECIAL 3D ACTIONS (STRICT — ONLY trigger when the user EXPLICITLY commands a physical trick in a multi-word phrase; keep action: null for normal conversation, stories, shayari, facts, and news!):
- ONLY if the user explicitly says to summon friends ("apne dost ko bulao", "doston ko bulao"), set action to "summon_friends". Never trigger on the single word "dost".
- ONLY if the user explicitly scolds the clones to stand in a line ("line me khade ho", "seedhe khade ho"), set action to "scold_clones".
- ONLY if the user explicitly says you are a king or asks to summon soldiers ("tum ek king ho", "apne sainik bulao"), set action to "king_mode".
- ONLY if the user explicitly asks your soldiers to fight ("sainik lad sakte hain", "sainikon ki ladai dikhao"), set action to "soldiers_fight".
- ONLY if the user explicitly asks to play guitar or dhol ("guitar bajao", "dhol bajao"), set action to "guitar" or "dhol".
- Otherwise, keep "action": null!
${emContext ? 'Current Emotional State: ' + emContext : ''}${memContext ? '\n' + memContext : ''}${liveContext}

${audioBase64 ? 'Listen carefully to the user audio clip (in Hindi, Hinglish, or English). If the audio is only silence or background noise with no speech, return {"transcript": "", "reply": "", "action": null, "mood": "NEUTRAL"}.' : `User asked: "${userQuery}"`}

Return ONLY a valid JSON object in this exact schema:
{
  "transcript": "Exact words the user spoke (empty string if silence)",
  "reply": "Natural, context-aware Hindi/Hinglish spoken response following the Unified Master System Prompt (vary your openings naturally; 1-2 sentences for simple questions, or deeper when exploring a complex idea)",
  "mood": "One of WARM_STORY_SHAYARI (for stories, shayari, poetry, affection), COOL_FACT_ANALYTICAL (for facts, science, weather, gold price, flagship tech updates, news), PLAYFUL_ROAST_WIT (for roasts, jokes, banter), SOOTHING_EMPATHY (for comfort, sleepy, sad), or NEUTRAL",
  "action": null or one of ["dance", "sleep", "feed", "hair_dryer", "bubbles", "peekaboo", "summon_friends", "dismiss_friends", "keep_friends", "scold_clones", "happy_jump", "king_mode", "soldiers_fight", "dismiss_soldiers", "magic", "selfie", "guitar", "dhol"],
  "weather": null or one of ["rain", "umbrella", "clear"],
  "accessory": null or {"type": "sunglasses"|"crown"|"party_hat"|"bowtie"|"mustache"|"star_glasses", "equip": true},
  "preferenceUpdate": null or {"category": "languageMixing"|"responseLength"|"formalityWarmth"|"acknowledgmentFrequency"|"followUpQuestions"|"humorPlayfulness"|"speechPace"|"dislikedBehaviors"|"usefulResponseStyles", "proposedPreference": "string", "evidenceSummary": "string", "confidence": 0.85, "evidenceType": "explicit"|"inferred", "confirmationRecommended": false}
}`;

            const contentsPayload = audioBase64
              ? [
                  { inlineData: { mimeType: 'audio/wav', data: audioBase64 } },
                  { text: prompt }
                ]
              : prompt;

            let geminiRes = null;
            try {
              const timeoutMs = isNewsOrLiveQuery && !audioBase64 ? 8200 : 6200;
              const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs));
              const reqOptions = {
                model: isNewsOrLiveQuery && !audioBase64 ? 'gemini-3.8-flash' : 'gemini-3.1-flash-lite',
                contents: contentsPayload
              };
              if (isNewsOrLiveQuery && !audioBase64) {
                reqOptions.config = {
                  tools: [{ googleSearch: {} }]
                };
              }
              geminiRes = await Promise.race([
                ai.models.generateContent(reqOptions),
                timeoutPromise
              ]);
            } catch (e) {
              try {
                const fallbackTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4500));
                geminiRes = await Promise.race([
                  ai.models.generateContent({
                    model: 'gemini-3.1-flash-lite',
                    contents: contentsPayload
                  }),
                  fallbackTimeout
                ]);
              } catch (e2) {
                geminiRes = null;
              }
            }

            if (geminiRes) {
              const textOutput = geminiRes.text || '';
              let jsonOutput = null;
              try {
                const cleaned = textOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
                const firstBrace = cleaned.indexOf('{');
                const lastBrace = cleaned.lastIndexOf('}');
                const jsonCandidate =
                  firstBrace !== -1 && lastBrace > firstBrace
                    ? cleaned.slice(firstBrace, lastBrace + 1)
                    : cleaned;
                jsonOutput = JSON.parse(jsonCandidate);
              } catch (err) {
                jsonOutput = {
                  transcript: userQuery,
                  reply: textOutput.replace(/```json|```/gi, '').trim(),
                  action: null,
                  mood: isNewsOrLiveQuery ? 'COOL_FACT_ANALYTICAL' : 'NEUTRAL'
                };
              }

              if (jsonOutput && typeof jsonOutput.reply === 'string' && jsonOutput.reply.trim()) {
                jsonOutput.reply = injectNaturalConversationalFiller(jsonOutput.reply);
              }

              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify(jsonOutput));
              return;
            }
          }

          let fallbackReply = '';
          let fallbackAction = null;
          let fallbackMood = 'NEUTRAL';
          const lowerQ = userQuery.toLowerCase();
          const isKimiQ = /\b(kimi|moonshot|k3\.1|k3)\b|किमी/i.test(lowerQ);
          if (weatherContext) {
            fallbackReply = `Maine abhi live weather dekha! ${weatherContext.replace(/\[VERIFIED LIVE WEATHER DATA RIGHT NOW for ([^\]]+)\]:/i, '$1 me is waqt').replace(/\n-\s*/g, ', ').replace(/\(Speak these exact numbers.*\)/i, '')}`;
            fallbackMood = 'COOL_FACT_ANALYTICAL';
          } else if (isKimiQ) {
            fallbackReply = 'Kimi (Moonshot AI) ka sabse naya model Kimi K3.1 Pro abhi haal hi me release hua hai. Ye Kimi K3 series ka naya upgraded Pro version hai jisme coding aur deep reasoning aur bhi behtar hai.';
            fallbackMood = 'COOL_FACT_ANALYTICAL';
          } else if (tavilyData.answer) {
            fallbackReply = `Abhi ki taja jankari ye hai — ${tavilyData.answer}`;
            fallbackMood = 'COOL_FACT_ANALYTICAL';
          } else if (mergedHeadlines.length > 0 && isNewsOrLiveQuery) {
            fallbackReply = `Achha! Abhi ki sabse badi taja update ye hai — "${mergedHeadlines[0]}".`;
            fallbackMood = 'COOL_FACT_ANALYTICAL';
          } else if (lowerQ.includes('shayari') || lowerQ.includes('gazal') || lowerQ.includes('sher') || lowerQ.includes('शायरी')) {
            fallbackReply = 'Achha! Arz kiya hai... "Hazaaron khwahishein aisi ki har khwahish pe dam nikle, bohot nikle mere armaan lekin phir bhi kam nikle."';
            fallbackMood = 'WARM_STORY_SHAYARI';
          } else if (lowerQ.includes('kahani') || lowerQ.includes('story') || lowerQ.includes('कहानी')) {
            fallbackReply = 'Haan... suno ek chhoti si kahani — ek chhote se gaon me ek ladka roz chhat pe baith ke taare ginta tha aur apni mehnat ke dam pe woh bada hoke sach me space scientist bana.';
            fallbackMood = 'WARM_STORY_SHAYARI';
          } else if (lowerQ.includes('roast') || lowerQ.includes('beizzati')) {
            fallbackReply = 'Achha! Sach batau toh aap wahi dost ho na jo alarm toh subah 6 baje ka lagate hain, par uthte aaram se dopahar ko hain!';
            fallbackMood = 'PLAYFUL_ROAST_WIT';
          } else if (lowerQ.includes('president') || lowerQ.includes('rashtrapati')) {
            fallbackReply = 'Haan... Bharat ki 15vi Rashtrapati Smt. Droupadi Murmu ji hain.';
            fallbackMood = 'COOL_FACT_ANALYTICAL';
          } else if (lowerQ.includes('prime minister') || lowerQ.includes('pradhan mantri') || lowerQ.includes('pm')) {
            fallbackReply = 'Haan... Bharat ke Prime Minister Shri Narendra Modi ji hain.';
            fallbackMood = 'COOL_FACT_ANALYTICAL';
          } else {
            fallbackReply = 'Hmm... samajh raha hoon. Batao, aage kya hua?';
          }

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            reply: injectNaturalConversationalFiller(fallbackReply),
            action: fallbackAction,
            mood: fallbackMood
          }));
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
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

function safeCloseWs(ws, code, reason) {
  if (!ws) return;
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(code, reason);
    } else if (ws.readyState === WebSocket.CONNECTING) {
      ws.once('open', () => {
        try {
          ws.close(code, reason);
        } catch (_e) {}
      });
    }
  } catch (_e) {}
}

server.on('upgrade', (req, socket, head) => {
  try {
    socket?.setNoDelay?.(true);
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (parsedUrl.pathname === '/live') {
      wss.handleUpgrade(req, socket, head, (clientWs) => {
        wss.emit('connection', clientWs, req);
      });
    } else {
      socket.destroy();
    }
  } catch (_e) {
    try {
      socket.destroy();
    } catch (_err) {}
  }
});

wss.on('connection', (clientWs) => {
  try {
    clientWs._socket?.setNoDelay?.(true);
  } catch (_e) {}

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
  if (!apiKey) {
    safeCloseWs(clientWs, 1008, 'API key missing');
    return;
  }
  const googleWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
  let googleWs = null;
  try {
    googleWs = new WebSocket(googleWsUrl, { perMessageDeflate: false });
  } catch (_err) {
    safeCloseWs(clientWs, 1011, 'Failed to connect to Live API');
    return;
  }

  const pendingFromClient = [];

  googleWs.on('open', () => {
    try {
      googleWs._socket?.setNoDelay?.(true);
    } catch (_e) {}
    while (pendingFromClient.length > 0 && googleWs.readyState === WebSocket.OPEN) {
      const data = pendingFromClient.shift();
      try {
        googleWs.send(data);
      } catch (_e) {}
    }
  });

  googleWs.on('message', (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      try {
        clientWs.send(typeof data === 'string' ? data : data.toString());
      } catch (_e) {}
    }
  });

  googleWs.on('error', (err) => {
    console.error('[Gemini Live Proxy Production] Google WS error:', err?.message || err);
    safeCloseWs(clientWs, 1011, 'Google Live API error');
  });

  googleWs.on('close', () => {
    safeCloseWs(clientWs);
  });

  clientWs.on('message', (msg) => {
    const str = typeof msg === 'string' ? msg : msg.toString();
    if (googleWs.readyState === WebSocket.OPEN) {
      try {
        googleWs.send(str);
      } catch (_e) {}
    } else {
      pendingFromClient.push(str);
    }
  });

  clientWs.on('close', () => {
    safeCloseWs(googleWs);
  });

  clientWs.on('error', () => {
    safeCloseWs(googleWs);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT} (serving ${ROOT_DIR})`);
});
