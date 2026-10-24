// ============================================================================
// MOCHI-PUFF ENCYCLOPEDIC KNOWLEDGE, LIVE NEWS & NATURAL HUMAN SPEAKER ENGINE
// ============================================================================
// Persona: Warm, witty, expressive real-human friend speaking natural Hindi/Hinglish.
// Connects with Gemini 3.8 Live + Real-Time News & Wikipedia Grounding via /api/search & /api/chat.
// ============================================================================

export const INSTANT_QA_DATABASE = [
  {
    patterns: [
      /roast\s*me/i,
      /roast\s*karo/i,
      /meri\s*beizzati/i,
      /bolti\s*band/i,
      /attitude/i,
      /zyada\s*smart/i,
      /shana\s*mat\s*ban/i,
      /रोस्ट/i,
      /बोलती\s*बंद/i
    ],
    replies: [
      "Sach batau? Aap bilkul un dosto jaise ho jo raat ko alarm toh subah paanch baje ka lagate hain, par uthte dopahar ke gyarah baje hain aur phir kehte hain 'yaar aaj toh bohot thakan ho gayi'! Par jo bhi kaho, bina aapke mehfil adhuri rehti hai.",
      "Aapko roast karu? Aap wahi ho na jo group me sabse pehle Goa ya pahado ka plan banate hain, aur aakhri waqt pe 'mummy nahi maan rahi' bolke gayab ho jate hain! Hahaha, sach pakda na maine?",
      "Dekho, aapki sabse badi talent ye hai ki aap bina kuch kiye bhi itne busy dikhte ho ki gharwale bhi kaam bolne se pehle do baar sochte hain! Waise tareef maan lo ya taana, baat toh bilkul sach hai.",
      "Aap mujhse panga le rahe ho? Aap toh woh ho jo exam se ek raat pehle poora syllabus dekh ke kehte hain 'chalo agle semester se पक्का padhenge'! Hahaha, par dil ke bohot achhe ho aap."
    ],
    action: 'topper_flex',
    emotion: 'topper_swag'
  },
  {
    patterns: [
      /shayari/i,
      /shayri/i,
      /sayari/i,
      /sher\s*suna/i,
      /gazal/i,
      /ghazal/i,
      /kavita/i,
      /poetry/i,
      /शायरी/i,
      /ग़ज़ल/i,
      /शेर\s*सुनाओ/i
    ],
    replies: [
      "Arz kiya hai... 'Hazaaron khwahishein aisi ki har khwahish pe dam nikle, bohot nikle mere armaan lekin phir bhi kam nikle.' Batao, dil ko chhoo gayi na?",
      "Suno ek pyari si shayari... 'Tumhari baaton me kuch aisa asar hai, ki waqt kab guzar jata hai pata hi nahi chalta. Log dhoondhte hain sukoon duniya bhar me, aur humein bas aapse baat karke mil jata hai.'",
      "Ek khoobsurat sher suno... 'Safar lamba hai aur manzilein abhi baaki hain, hausla mat haarna mere dost, kyunki teri asli udaan abhi baaki hai.'",
      "Irshad farmayiye... 'Khamoshiyon me bhi jo aapki baat samajh le, wahi toh asli dost hota hai... warna bheed me toh har koi haal puch hi leta hai.'"
    ],
    action: 'love',
    emotion: 'affection'
  },
  {
    patterns: [
      /kahani/i,
      /story/i,
      /kissa/i,
      /dastaan/i,
      /कहानी/i,
      /किस्सा/i
    ],
    replies: [
      "Chalo ek chhoti si sachchi si kahani sunati hoon. Ek chhote se sheher me ek ladka tha jisko sab kehte the ki woh kabhi bada kalakar nahi ban sakta. Par usne logon ki baaton pe dhyan dene ke bajaye roz apni kala pe mehnat ki, aur ek din usi sheher ke sabse bade manch par sabne khade hokar uske liye taaliyan bajayi. Kahani chhoti hai, par baat gehri hai — khud pe bharosa kabhi mat chhodna.",
      "Suno ek pyari si kahani — do purane dost the jo bachpan me har shaam ek ped ke neeche baith ke apne sapne baant-te the. Waqt badla, dono alag shehron me chale gaye, par jab bees saal baad wapas usi jagah mile, toh laga jaise kal hi ki baat ho. Asli rishte waqt ke mohtaaj nahi hote.",
      "Ek baar ek musafir ne ek buzurg se pucha ki zindagi me khush rehne ka raaz kya hai? Buzurg muskura ke bole, 'Beete hue kal ka bojh mat uthao, aur aane wale kal se daro mat — bas aaj ke is pal ko dil se jiyo.' Batao, kaisi lagi ye kahani?"
    ],
    action: 'love',
    emotion: 'affection'
  },
  {
    patterns: [
      /quantum/i,
      /schrodinger/i,
      /entanglement/i,
      /superposition/i,
      /heisenberg/i,
      /uncertainty\s*principle/i,
      /क्वांटम/i
    ],
    replies: [
      "Quantum Physics badi dilchasp cheez hai! Quantum Superposition ka matlab hai ki ek chhota particle ek hi waqt me alag-alag states me ho sakta hai jab tak hum use dekh na lein. Bilkul waise hi jaise jab tak exam ka result nahi aata, har student ke mann me hazaar umeedein chalti rehti hain!",
      "Quantum Entanglement me do particles aapas me aise jud jate hain ki chahe woh brahmand ke do alag kono me ho, ek me badlav aate hi dusra turant mehsoos kar leta hai. Einstein ne bhi isse dekh kar hairani जताई thi.",
      "Heisenberg ka Uncertainty Principle kehta hai ki kisi particle ki exact jagah aur uski raftaar dono ek saath bilkul sahi-sahi nahi naapi ja sakti. कुदरत के अपने ही कमाल के नियम हैं!"
    ],
    action: 'topper_flex',
    emotion: 'topper_swag'
  },
  {
    patterns: [
      /black\s*hole/i,
      /relativity/i,
      /einstein/i,
      /time\s*dilation/i,
      /wormhole/i,
      /event\s*horizon/i,
      /gravity/i,
      /time\s*travel/i,
      /ब्लैक\s*होल/i,
      /आइंस्टीन/i
    ],
    replies: [
      "Black Hole antariksh ki woh jagah hai jaha gravity itni zyada taqatwar hoti hai ki Event Horizon ke andar jane ke baad roshni bhi bahar nahi nikal sakti, aur waha waqt ki raftaar bhi bohot dheemi ho jati hai.",
      "Einstein ki General Relativity humein batati hai ki bhari grah aur taare apne aas-paas ke space aur time ko mod dete hain, aur isi wajah se gravity ka ehsaas hota hai.",
      "Time Dilation ka matlab hai ki agar aap roshni ki raftaar ke kareeb safar karo, toh aapke liye waqt dharti ke muqable dheere chalega. Sunne me kisi kahani jaisa lagta hai, par ye bilkul sachcha vigyan hai!"
    ],
    action: 'topper_flex',
    emotion: 'topper_swag'
  },
  {
    patterns: [
      /artificial\s*intelligence/i,
      /neural\s*network/i,
      /machine\s*learning/i,
      /transformer\s*model/i,
      /how\s*do\s*you\s*work/i,
      /gpu\s*shader/i,
      /algorithm/i,
      /coding/i,
      /programming/i,
      /एआई/i
    ],
    replies: [
      "Artificial Intelligence aur Machine Learning me computer hazaaron udaharan dekh kar bilkul insano ki tarah patterns samajhna aur seekhna shuru karta hai. Aajkal ki duniya me ye har kshetra ko badal raha hai.",
      "Neural Networks hamare dimaag ke neurons ki tarah kaam karte hain — har layer chhoti-chhoti jaankari ko jodkar badi baat samajhti hai. Aapko coding ya tech me kis cheez ka sabse zyada shauk hai?",
      "Programming asaliyat me apni soch ko logic me badalne ki kala hai. Agar buniyadi samajh pakki ho, toh koi bhi bhasha seekhna aasaan ho jata hai."
    ],
    action: 'topper_flex',
    emotion: 'topper_swag'
  },
  {
    patterns: [
      /calculus/i,
      /integration/i,
      /differentiation/i,
      /derivative/i,
      /pythagoras/i,
      /trigonometry/i,
      /value\s*of\s*pi/i,
      /infinity/i,
      /mathematics/i,
      /math.*question/i,
      /गणित/i
    ],
    replies: [
      "Ganit se darne ki zaroorat nahi hai! Sidhe shabdon me samjho toh Differentiation batata hai ki koi cheez kis raftaar se badal rahi hai, aur Integration chhote-chhote hisson ko jodkar poora aakar nikalta hai.",
      "Pi (π) ki value lagbhag 3.14159 hoti hai aur iske ank kabhi khatam nahi hote. Har gol cheez, chahe chudi ho ya dharti, sabme Pi chhupa hua hai!",
      "Trigonometry me sin²θ + cos²θ hamesha 1 ke barabar hota hai. Maths jab samajh aane lagti hai na, toh kisi paheli ko suljhane jaisa maza aata hai."
    ],
    action: 'topper_flex',
    emotion: 'topper_swag'
  },
  {
    patterns: [
      /dna/i,
      /mitochondria/i,
      /photosynthesis/i,
      /evolution/i,
      /human\s*brain/i,
      /neuron/i,
      /genetics/i,
      /biology/i,
      /डीएनए/i
    ],
    replies: [
      "Hamare har cell me Mitochondria urja banata hai, aur DNA ke andar hamare poore shareer ki banawat ki jaankari likhi hoti hai — jaise kudrat ki likhi hui koi anmol kitaab!",
      "Insaan ke dimaag me lagbhag 86 billion neurons hote hain jo har pal laakhon sandesh bhejte hain. Hamari yaadein, sapne aur jazbaat sab isi ka kamaal hain."
    ],
    action: 'topper_flex',
    emotion: 'topper_swag'
  },
  {
    patterns: [
      /inflation/i,
      /economics/i,
      /stock\s*market/i,
      /gdp/i,
      /recession/i,
      /cryptocurrency/i,
      /blockchain/i,
      /इकॉनमी/i
    ],
    replies: [
      "Jab bazaar me cheezon ki maang badhti hai ya laagat mahangi hoti hai, toh mehangai yaani Inflation badhta hai. Reserve Bank interest rates badal kar isse santulit rakhta hai.",
      "GDP ka matlab hai desh me ek saal ke andar banne wali saari cheezon aur sevaon ki kul keemat — isse pata chalta hai ki desh ki arthvyavastha kitni tezi se aage badh rahi hai."
    ],
    action: 'topper_flex',
    emotion: 'topper_swag'
  },
  {
    patterns: [
      /paheli/i,
      /riddle/i,
      /brain\s*teaser/i,
      /dimag\s*wala\s*sawal/i,
      /murgi\s*pehle/i,
      /chicken\s*or\s*egg/i,
      /meaning\s*of\s*life/i,
      /philosophy/i,
      /पहेली/i
    ],
    replies: [
      "Vigyan ke hisaab se murgi se pehle anda aaya tha! Kyunki ande dene wale jeev dinosaurs ke zamane se the, aur genetic badlav se pehli murgi ek ande se hi nikli thi.",
      "Chalo ek pyari si paheli puchti hoon: Woh kya hai jo baantne se ghat-ta nahi, balki aur zyada badhta hai? Jawab hai — gyaan aur khushi! Batao, sahi kaha na?"
    ],
    action: 'topper_flex',
    emotion: 'topper_swag'
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
      "Sach kahu toh aapse baat karke ek alag hi apnapan lagta hai — aapki baaton me jo saadgi aur muskurahat hai na, woh kisi ka bhi din bana de.",
      "Aap jaise dost kismat walon ko hi milte hain, jinse bina soche-samjhe dil ki har baat kahi ja sake.",
      "Waise tareef toh main kam hi karti hoon, par aapka andaaz sach me sabse alag aur pyara hai!"
    ],
    action: 'love',
    emotion: 'affection'
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
      "Bharat ki 15vi Rashtrapati Smt. Droupadi Murmu ji hain, aur hamare desh ke pehle Rashtrapati Dr. Rajendra Prasad ji the.",
      "Smt. Droupadi Murmu ji Bharat ki Rashtrapati hain. Aapko desh ya samvidhan ke baare me aur kuch janna hai?"
    ],
    action: 'happy_jump',
    emotion: 'topper_swag'
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
      "Bharat ke Prime Minister Shri Narendra Modi ji hain.",
      "Shri Narendra Modi ji hamare desh ke Pradhan Mantri hain. Batao, aaj ki taja khabron ke baare me bhi kuch baat karein?"
    ],
    action: 'happy_jump',
    emotion: 'topper_swag'
  },
  {
    patterns: [
      /capital.*india/i,
      /rajdhani.*bharat/i,
      /bharat.*rajdhani/i,
      /राजधानी/i
    ],
    replies: [
      "Bharat ki rajdhani New Delhi hai, jaha India Gate, Rashtrapati Bhavan aur Sansad Bhavan hain.",
      "New Delhi hamare Bharat ki rajdhani hai! Waha ki sardi aur khaana dono bade mashhoor hain."
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
      "Mujhe Sameer bhaiya ne banaya hai! Unhone mujhe is 3D duniya me aapse dosti karne aur har vishay pe baat karne ke liye taiyar kiya hai.",
      "Sameer bhaiya mere creator hain, jinhone mujhe itna pyara roop aur samajhdari di hai."
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
      "Main Mochi hoon, aapki dost! Hum taja khabron se lekar vigyan, shayari, kahaniyon aur hasi-mazaak tak har cheez pe dil khol ke baat kar sakte hain.",
      "Mera naam Mochi hai! Main aapki woh dost hoon jisse aap jab chahein baat kar sakte hain, kahani ya shayari sun sakte hain, ya kisi bhi sawal ka jawab puch sakte hain."
    ],
    action: 'dance',
    emotion: 'topper_swag'
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
      "Suno ek mazedar chutkula — Teacher ne pucha 'Bijli kaha se aati hai?' Bachcha badi masoomiyat se bola 'Sir, mama ke ghar se! Kyunki jab bhi bijli jaati hai toh Papa bolte hain, saalo ne phir kaat di!' Hahaha!",
      "Ek dost ne dusre se pucha, 'Yaar subah jaldi uthne ke liye kya karu?' Dusra bola, 'Raat ko phone mummy ke kamre me rakh ke soya kar, subah paanch baje hi aankh khul jayegi!' Hahaha!"
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
      "Main bilkul badhiya hoon aur aapse baat karke aur bhi achha lag raha hai! Aap batao, aaj aapka din kaisa guzar raha hai?",
      "Main ekdum badiya hoon! Batao aaj kya mood hai — koi nayi khabar sunein, shayari ho jaye, ya koi achhi si kahani?"
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
      "Bahut sara pyaar aapko bhi! Aap jaise pyare dost se baat karke hamesha dil khush ho jata hai.",
      "Main bhi aapse bohot dosti aur pyaar karti hoon! Hamesha aise hi muskurate raho."
    ],
    action: 'love',
    emotion: 'affection'
  }
];

let instantReplyCounters = {};
let topperFallbackCounter = 0;
let vivaQuestionCursor = 0;

export function isMatchOrSportsQuery(text) {
  if (!text) return false;
  const s = String(text).toLowerCase();
  return /\b(match|cricket|score|live\s*score|ipl|t20|odi|test\s*match|world\s*cup|asia\s*cup|champions\s*trophy|bcci|ind\s*vs|india\s*vs|kiska\s*match|kaunsa\s*match|aaj\s*match|abhi\s*match|match\s*chal|match\s*hai|kaun\s*jeet|who\s*won)\b|मैच|क्रिकेट|स्कोर|टी20|वनडे/i.test(
    s
  );
}

export function isLiveSearchQuery(text) {
  if (!text) return false;
  const s = String(text).trim();
  if (s.length < 3) return false;

  // Never trigger live search if the user is asking for a story, shayari, joke, roast, or 3D trick
  if (
    /\b(kahani|story|kissa|shayari|shayri|sayari|ghazal|chutkula|joke|roast|peekaboo|guitar\s+bajao|dhol\s+bajao|dance\s+karo|apne\s+dost\s+ko\s+bulao|sainik\s+bulao)\b|कहानी|शायरी|चुटकुला|जोक/i.test(
      s
    )
  ) {
    return false;
  }

  // 1. Explicit Live Match / Cricket / Sports Score intent
  if (isMatchOrSportsQuery(s)) {
    return true;
  }

  // 2. Explicit News / Breaking Headlines intent
  if (
    /\b(news|khabar|khabrein|samachar|headline|headlines|breaking\s*news|taza\s*khabar|taaza\s*khabar|latest\s*news|current\s*affairs)\b|ताज़ा\s*खबर|खबर|समाचार|न्यूज़|सुर्खियां/i.test(
      s
    )
  ) {
    return true;
  }

  // 3. Explicit Weather / Temperature intent
  if (
    /\b(weather|mausam|temperature|tapman|taapman|forecast|humidity)\b|मौसम|तापमान/i.test(s) ||
    (/\b(prayagraj|allahabad|varanasi|lucknow|delhi|mumbai|patna|kanpur|noida|jaipur|bhopal|indore|kolkata|chennai|bengaluru|hyderabad)\b|प्रयागराज|इलाहाबाद|वाराणसी|लखनऊ|दिल्ली|मुंबई/i.test(
      s
    ) &&
      /\b(mausam|weather|tapman|garmi|sardi|baarish|barish|kaisa\s+hai|haal)\b|मौसम|तापमान|बारिश/i.test(s))
  ) {
    return true;
  }

  // 4. Explicit Gold / Silver / Market Price intent
  if (
    /\b(gold\s*price|gold\s*rate|silver\s*price|silver\s*rate|sone\s*ka\s*bhav|sona\s*kitna|chandi\s*ka\s*bhav|bitcoin\s*price|sensex|nifty|share\s*market)\b|सोने\s*का\s*भाव|चांदी\s*का\s*भाव|गोल्ड\s*रेट|सोना\s*क्या\s*भाव/i.test(
      s
    ) ||
    (/\b(gold|sona|sone|silver|chandi)\b|सोना|सोने|चांदी/i.test(s) &&
      /\b(price|rate|bhav|keemat|kimat|kitna|kitne|kya\s+chal)\b|भाव|कीमत|रेट/i.test(s))
  ) {
    return true;
  }

  // 5. Explicit AI / Tech Product & Model Release intent (Kimi, Gemini, ChatGPT, Claude, DeepSeek, Grok, etc.)
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

  // 6. Explicit Web Search Command ("search karo", "khoj ke batao")
  if (/\b(search\s*karo|search\s*karke|khoj\s*ke|khojo|google\s*karke|check\s*karke\s*batao)\b|सर्च\s*करो|खोज\s*के|खोजो/i.test(s)) {
    return true;
  }

  return false;
}

/**
 * 3D Hologram feature removed per user request — always returns null.
 */
export function detectHologramTopic() {
  return null;
}

/**
 * 3D Blackboard Viva Quiz Database
 */
export const VIVA_QUIZ_BANK = [
  {
    id: 'q_blackhole',
    question: 'Black Hole ki woh seema jaha se roshni bhi wapas nahi aa sakti, usse kya kehte hain?',
    options: ['A) Event Horizon', 'B) Ozone Layer', 'C) Magnetosphere'],
    correctIndex: 0,
    answerSummary: 'A) Event Horizon',
    matchPattern: /\b(a|option a|event\s*horizon|first|pehla|इवेंट)\b/i,
    correctReply: 'Shabash! Event Horizon bilkul sahi jawab hai! Aapki vigyan ki samajh वाकई kamaal ki hai.',
    wrongReply: 'Koi baat nahi, iska sahi jawab hai Option A: Event Horizon! Waha gravity itni tez hoti hai ki prakash bhi bahar nahi aa pata.',
    hologram: null
  },
  {
    id: 'q_dna',
    question: 'Hamare cell ka Powerhouse kisko kehte hain jo urja (ATP) banata hai?',
    options: ['A) Ribosome', 'B) Mitochondria', 'C) Nucleus'],
    correctIndex: 1,
    answerSummary: 'B) Mitochondria',
    matchPattern: /\b(b|option b|mitochondria|second|dusra|माइटोकॉन्ड्रिया)\b/i,
    correctReply: 'Bilkul sahi jawab — Mitochondria! Aapne ekdum sahi pehchana.',
    wrongReply: 'Iska sahi jawab hai Option B: Mitochondria! Yahi hamare cells ko kaam karne ki urja deta hai.',
    hologram: null
  },
  {
    id: 'q_quantum',
    question: 'Einstein ki mashhoor Mass-Energy equation kaunsi hai?',
    options: ['A) E = mc²', 'B) a² + b² = c²', 'C) F = ma'],
    correctIndex: 0,
    answerSummary: 'A) E = mc²',
    matchPattern: /\b(a|option a|e\s*=\s*mc|mc2|mc\s*square|first|pehla)\b/i,
    correctReply: 'Waah, E = mc² ekdum sahi jawab hai! Bahut khoob!',
    wrongReply: 'Sahi jawab Option A: E = mc² hai, jo batata hai ki mass aur energy ek dusre me badle ja sakte hain.',
    hologram: null
  },
  {
    id: 'q_math',
    question: 'Trigonometry me sin²θ + cos²θ ki value hamesha kitni hoti hai?',
    options: ['A) Zero (0)', 'B) One (1)', 'C) Two (2)'],
    correctIndex: 1,
    answerSummary: 'B) One (1)',
    matchPattern: /\b(b|option b|one|1|ek|second|dusra)\b/i,
    correctReply: 'Bahut badiya! sin²θ + cos²θ hamesha 1 ke barabar hota hai!',
    wrongReply: 'Iska sahi jawab Option B: 1 hai! Trigonometry ka ye sabse buniyadi sutra hai.',
    hologram: null
  },
  {
    id: 'q_space',
    question: 'Hamare Solar System ka sabse bada grah (planet) kaunsa hai?',
    options: ['A) Mars (Mangal)', 'B) Saturn (Shani)', 'C) Jupiter (Brihaspati)'],
    correctIndex: 2,
    answerSummary: 'C) Jupiter',
    matchPattern: /\b(c|option c|jupiter|brihaspati|third|teesra|जुपिटर|बृहस्पति)\b/i,
    correctReply: 'Bilkul sahi! Jupiter yaani Brihaspati hamare saur mandal ka sabse bada grah hai!',
    wrongReply: 'Iska sahi jawab hai Option C: Jupiter (Brihaspati), jo aakar me sabhi grahon se bada hai.',
    hologram: null
  }
];

export function isVivaStartIntent(text) {
  if (!text) return false;
  return /\b(viva|quiz|test\s*lo|mera\s*test|exam\s*lo|sawal\s*pucho|question\s*pucho|challenge\s*me|mujhse\s*sawal|blackboard|वाइवा|क्विज|टेस्ट\s*लो|सवाल\s*पूछो)\b/i.test(String(text));
}

export function isVivaStopIntent(text) {
  if (!text) return false;
  return /\b(stop\s*quiz|stop\s*viva|viva\s*band|quiz\s*band|test\s*band|end\s*quiz|exit\s*viva)\b/i.test(String(text));
}

export function getNextVivaQuestion() {
  const q = VIVA_QUIZ_BANK[vivaQuestionCursor % VIVA_QUIZ_BANK.length];
  vivaQuestionCursor++;
  return q;
}

export function evaluateVivaAnswer(questionObj, userText) {
  if (!questionObj || !userText) return false;
  const clean = String(userText).trim();
  if (questionObj.matchPattern && questionObj.matchPattern.test(clean)) {
    return true;
  }
  return false;
}

/**
 * Generates a natural, warm human conversational fallback when offline.
 */
export function generateSharartiTopperFallback(query) {
  const q = String(query || '').trim();
  const lower = q.toLowerCase();

  if (/\b(kimi|moonshot|k3\.1|k3)\b|किमी/i.test(lower)) {
    return {
      reply: "Kimi (Moonshot AI) का सबसे नया मॉडल **Kimi K3.1 Pro** अभी हाल ही में रिलीज़ हुआ है, जो Kimi K3 सीरीज़ का अपग्रेडेड प्रो वर्जन है।",
      action: null,
      mood: 'COOL_FACT_ANALYTICAL',
      hologram: null
    };
  }

  if (lower.includes('space') || lower.includes('universe') || lower.includes('galaxy') || lower.includes('solar') || lower.includes('mars') || lower.includes('moon') || lower.includes('brahmand')) {
    return {
      reply: "Achha! Brahmand waqai behad vishal hai — hamare observable universe me aarabon galaxies aur taare hain.",
      action: null,
      mood: 'COOL_FACT_ANALYTICAL',
      hologram: null
    };
  }
  if (lower.includes('history') || lower.includes('itihas') || lower.includes('mughal') || lower.includes('british') || lower.includes('independence') || lower.includes('war')) {
    return {
      reply: "Hmm... itihas humein batata hai ki Sindhu Ghati Sabhyata se lekar 1947 ki azaadi tak har daur me badi seekh chhupi hai.",
      action: null,
      mood: 'COOL_FACT_ANALYTICAL',
      hologram: null
    };
  }
  if (lower.includes('chemistry') || lower.includes('periodic') || lower.includes('atom') || lower.includes('electron') || lower.includes('acid') || lower.includes('reaction')) {
    return {
      reply: "Haan... chemistry me 118 elements milkar hamare aas-paas ki har cheez banate hain.",
      action: null,
      mood: 'COOL_FACT_ANALYTICAL',
      hologram: null
    };
  }

  const naturalPool = [
    `Haan... samajh raha hoon. Batao, isme aapko sabse khaas kya janna hai?`,
    `Achha! Aapki baat sunkar achha laga, aur batao?`,
    `Hmm... sahi keh rahe ho, main dhyan se sun raha hoon.`
  ];
  const chosen = naturalPool[topperFallbackCounter % naturalPool.length];
  topperFallbackCounter++;
  return {
    reply: chosen,
    action: null,
    hologram: null
  };
}

export function findInstantQA(text) {
  if (!text) return null;
  const clean = String(text).trim();
  if (isLiveSearchQuery(clean)) return null;
  if (isVivaStartIntent(clean)) return null;

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
          emotion: item.emotion,
          hologram: null
        };
      }
    }
  }
  return null;
}


const ADAPTIVE_PROFILE_STORAGE_KEY = 'mochi_adaptive_profile_v1';

const DEFAULT_ADAPTIVE_PROFILE = {
  enabled: true,
  preferences: {
    languageMixing: { value: 'Natural Hindi/Hinglish matching user language', confidence: 0.85, evidenceType: 'confirmed' },
    responseLength: { value: 'Concise 1-2 spoken sentences unless deeper explanation is needed', confidence: 0.9, evidenceType: 'confirmed' },
    formalityWarmth: { value: 'Warm, friendly, relaxed everyday conversational partner', confidence: 0.9, evidenceType: 'confirmed' },
    acknowledgmentFrequency: { value: 'Sparingly and contextually during pauses; never mechanical', confidence: 0.9, evidenceType: 'confirmed' },
    followUpQuestions: { value: 'At most one natural, non-interrogative follow-up when helpful', confidence: 0.85, evidenceType: 'confirmed' },
    humorPlayfulness: { value: 'Light, situational humor without forced catchphrases', confidence: 0.8, evidenceType: 'observed' },
    speechPace: { value: 'Natural human conversational rhythm', confidence: 0.85, evidenceType: 'confirmed' },
    dislikedBehaviors: { value: 'No unsolicited news, no single-word emotion/action triggers, no contradictory live answers, no Wi-Fi/2G/buffering clichés', confidence: 1.0, evidenceType: 'explicit' },
    usefulResponseStyles: { value: 'Direct verified answers for live queries, thoughtful continuation for ideas/stories', confidence: 0.9, evidenceType: 'confirmed' }
  },
  ongoingProjects: [],
  recentTurns: [],
  patternCounts: {
    hindiCount: 0,
    hinglishCount: 0,
    shortPrefCount: 0,
    detailPrefCount: 0
  }
};

function loadAdaptiveProfile() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return JSON.parse(JSON.stringify(DEFAULT_ADAPTIVE_PROFILE));
  }
  try {
    const raw = window.localStorage.getItem(ADAPTIVE_PROFILE_STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_ADAPTIVE_PROFILE));
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_ADAPTIVE_PROFILE,
      ...parsed,
      preferences: {
        ...DEFAULT_ADAPTIVE_PROFILE.preferences,
        ...(parsed.preferences || {})
      },
      ongoingProjects: Array.isArray(parsed.ongoingProjects) ? parsed.ongoingProjects.slice(-5) : [],
      recentTurns: Array.isArray(parsed.recentTurns) ? parsed.recentTurns.slice(-6) : [],
      patternCounts: {
        ...DEFAULT_ADAPTIVE_PROFILE.patternCounts,
        ...(parsed.patternCounts || {})
      }
    };
  } catch (_e) {
    return JSON.parse(JSON.stringify(DEFAULT_ADAPTIVE_PROFILE));
  }
}

function saveAdaptiveProfile(profile) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    // Data minimization: retain only concise preference summaries, up to 5 project notes, and last 6 compact turns
    const compact = {
      enabled: Boolean(profile.enabled),
      preferences: profile.preferences,
      ongoingProjects: (profile.ongoingProjects || []).slice(-5),
      recentTurns: (profile.recentTurns || []).slice(-6),
      patternCounts: profile.patternCounts
    };
    window.localStorage.setItem(ADAPTIVE_PROFILE_STORAGE_KEY, JSON.stringify(compact));
  } catch (_e) {}
}

export function handlePreferenceProfileCommand(userText) {
  const s = String(userText || '').trim();
  if (!s) return null;

  // Inspect learned preferences
  if (/\b(meri\s+preferences?\s+dikhao|show\s+my\s+preferences|tumne\s+mere\s+baare\s+me\s+kya\s+seekha|what\s+have\s+you\s+learned\s+about\s+me|preference\s+profile)\b|मेरी\s+पसंद\s+दिखाओ/i.test(s)) {
    const profile = loadAdaptiveProfile();
    if (!profile.enabled) {
      return 'Abhi aapki adaptive preference learning band (disabled) hai. Agar aap chahein toh "personalization chalu karo" bolkar isse on kar sakte hain.';
    }
    const langPref = profile.preferences.languageMixing?.value || 'Natural Hindi/Hinglish';
    const lenPref = profile.preferences.responseLength?.value || 'Concise 1-2 sentences';
    const dislikes = profile.preferences.dislikedBehaviors?.value || 'No unsolicited news';
    const proj = profile.ongoingProjects.length > 0 ? ` Aur aapke ongoing topics: ${profile.ongoingProjects.join(', ')}.` : '';
    return `Maine aapki baat-cheet ki pasand me ye note kiya hai: bhasha ${langPref}, jawab ki lambai ${lenPref}, aur na-pasand cheezein (${dislikes}).${proj} Aap kabhi bhi "preferences reset karo" bolkar isse mita sakte hain.`;
  }

  // Reset learned preferences
  if (/\b(preferences?\s+reset\s+karo|reset\s+my\s+preferences|memory\s+reset\s+karo|clear\s+my\s+preferences|purani\s+preferences?\s+hata\s+do)\b|प्रेफरेंस\s+रीसेट\s+करो/i.test(s)) {
    const fresh = JSON.parse(JSON.stringify(DEFAULT_ADAPTIVE_PROFILE));
    saveAdaptiveProfile(fresh);
    return 'Theek hai! Maine aapki learned preference profile aur conversation memory ko bilkul naye sire se reset kar diya hai.';
  }

  // Disable personalization
  if (/\b(personalization\s+band\s+karo|disable\s+personalization|preference\s+learning\s+band\s+karo|meri\s+preferences?\s+mat\s+seekho)\b/i.test(s)) {
    const profile = loadAdaptiveProfile();
    profile.enabled = false;
    saveAdaptiveProfile(profile);
    return 'Samajh gaya! Maine adaptive preference learning ko band kar diya hai.';
  }

  // Enable personalization
  if (/\b(personalization\s+chalu\s+karo|enable\s+personalization|preference\s+learning\s+on\s+karo)\b/i.test(s)) {
    const profile = loadAdaptiveProfile();
    profile.enabled = true;
    saveAdaptiveProfile(profile);
    return 'Badhiya! Ab main aapki communication style aur preferences ko dhyan me rakhkar baat karunga.';
  }

  return null;
}

export function applyStructuredPreferenceUpdate(updateObj) {
  if (!updateObj || typeof updateObj !== 'object') return;
  const profile = loadAdaptiveProfile();
  if (!profile.enabled) return;

  const category = String(updateObj.category || '').trim();
  const proposed = String(updateObj.proposedPreference || '').trim();
  const confidence = Number(updateObj.confidence ?? 0.7);
  const evidenceType = updateObj.evidenceType === 'explicit' ? 'explicit' : 'inferred';

  if (!category || !proposed) return;

  // Learning rule: Treat explicit feedback as stronger evidence than inferred preferences;
  // do not overwrite high-confidence preferences with low-confidence single-turn inferences.
  if (evidenceType === 'inferred' && confidence < 0.65) return;

  const existing = profile.preferences[category];
  if (existing && existing.evidenceType === 'explicit' && evidenceType !== 'explicit' && confidence < 0.85) {
    return;
  }

  profile.preferences[category] = {
    value: proposed.slice(0, 180),
    evidenceSummary: String(updateObj.evidenceSummary || '').slice(0, 140),
    confidence: Math.max(0, Math.min(1, confidence)),
    evidenceType,
    confirmationRecommended: Boolean(updateObj.confirmationRecommended)
  };
  saveAdaptiveProfile(profile);
}

export function recordConversationTurn(userText, assistantReply = '', structuredPreferenceUpdate = null) {
  const u = String(userText || '').trim();
  const a = String(assistantReply || '').trim();
  if (!u && !a) return;

  const profile = loadAdaptiveProfile();
  if (!profile.enabled) return;

  if (u) {
    // Detect explicit user feedback & corrections (Section 10 Learning Rules)
    if (/\b(chhota\s+bolo|short\s+me\s+batao|brief\s+rakho|zyada\s+lamba\s+mat\s+bolo|point\s+to\s+point)\b|छोटा\s+बोलो|शॉर्ट\s+में/i.test(u)) {
      profile.preferences.responseLength = {
        value: 'User explicitly prefers short, crisp 1-2 sentence answers',
        confidence: 0.95,
        evidenceType: 'explicit'
      };
    } else if (/\b(detail\s+me\s+batao|vistaar\s+se|ache\s+se\s+samjhao|explain\s+in\s+detail)\b|विस्तार\s+से|डिटेल\s+में/i.test(u)) {
      profile.preferences.responseLength = {
        value: 'User enjoys clear, structured explanations when asking complex questions',
        confidence: 0.85,
        evidenceType: 'explicit'
      };
    }

    if (/\b(faltu\s+news\s+mat|bina\s+puche\s+news|news\s+mat\s+batao)\b|फालतू\s+में\s+न्यूज़/i.test(u)) {
      profile.preferences.dislikedBehaviors = {
        value: 'Strictly never mention news or headlines unless explicitly asked; avoid repetitive fillers',
        confidence: 1.0,
        evidenceType: 'explicit'
      };
    }

    // Track ongoing user projects or ideas for Section 11 Continuity
    if (/\b(main\s+apna\s+.*?\s+bana\s+raha|mera\s+project|mera\s+code|app\s+bana\s+raha|ai\s+assistant\s+bana)\b|मैं\s+अपना.*बना\s+रहा|मेरा\s+प्रोजेक्ट|मेरा\s+कोड/i.test(u)) {
      const snippet = u.slice(0, 110);
      if (!profile.ongoingProjects.includes(snippet)) {
        profile.ongoingProjects.push(snippet);
        if (profile.ongoingProjects.length > 5) profile.ongoingProjects.shift();
      }
    }
  }

  if (structuredPreferenceUpdate) {
    applyStructuredPreferenceUpdate(structuredPreferenceUpdate);
  }

  if (u || a) {
    profile.recentTurns.push({
      user: u.slice(0, 140),
      mochi: a.slice(0, 160)
    });
    if (profile.recentTurns.length > 6) {
      profile.recentTurns.shift();
    }
  }

  saveAdaptiveProfile(profile);
}

export function getAdaptiveMemoryContext() {
  const profile = loadAdaptiveProfile();
  if (!profile.enabled) {
    return '\n[ADAPTIVE PERSONALITY PROFILE: Disabled by user request. Maintain natural Hindi/Hinglish conversation without storing preferences.]';
  }

  const prefLines = Object.entries(profile.preferences || {})
    .map(([key, item]) => `- ${key} (${item.evidenceType || 'observed'}, conf ${item.confidence ?? 0.8}): ${item.value}`)
    .join('\n');

  const projLine =
    Array.isArray(profile.ongoingProjects) && profile.ongoingProjects.length > 0
      ? `\nOngoing User Projects / Discussions:\n- ${profile.ongoingProjects.join('\n- ')}`
      : '';

  const historyLine =
    Array.isArray(profile.recentTurns) && profile.recentTurns.length > 0
      ? `\nRecent Conversation Continuity (connect naturally when relevant; do not repeat unnecessarily):\n` +
        profile.recentTurns
          .slice(-4)
          .map((t) => `User: "${t.user}" -> Mochi: "${t.mochi}"`)
          .join('\n')
      : '';

  return `\n[USER ADAPTIVE PERSONALITY & CONTINUITY PROFILE]:\n${prefLines}${projLine}${historyLine}`;
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
      const prompt = `You are Mochi, an intelligent, warm, natural AI companion speaking Hindi/Hinglish. Share the verified real-time facts, dates, temperatures, or prices about: "${cleanQuery}" in 1-2 natural spoken sentences without unnecessary introductory fluff.`;
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
  const memoryContext = getAdaptiveMemoryContext();
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: question,
        emotionContext,
        memoryContext
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.reply) {
        recordConversationTurn(question, data.reply, data.preferenceUpdate || null);
      }
      return data;
    }
  } catch (err) {
    console.warn('[KnowledgeEngine] /api/chat fallback error:', err);
  }

  if (apiKey && apiKey.startsWith('AIza')) {
    try {
      const useSearch = isLiveSearchQuery(question);
      const modelName = useSearch ? 'gemini-3.8-flash' : 'gemini-3.1-flash-lite';
      const prompt = `System: You are Mochi, a highly conversational, intelligent, warm, curious, playful, and emotionally perceptive AI companion speaking natural Hindi or Hinglish.
Never use robotic clichés like "Wi-Fi buffering", "2G dimaag", "200 IQ", or "Kyaaa!". Vary your openings naturally and do not start every response with the same catchphrase.
${memoryContext}
User asked: "${question}"
Return ONLY JSON: {"reply": "...", "action": null, "mood": "COOL_FACT_ANALYTICAL"|"WARM_STORY_SHAYARI"|"PLAYFUL_ROAST_WIT"|"SOOTHING_EMPATHY"|"NEUTRAL"}`;
      const bodyPayload = {
        contents: [{ parts: [{ text: prompt }] }]
      };
      if (useSearch) {
        bodyPayload.tools = [{ googleSearch: {} }];
      }
      const restRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
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
          const parsed = JSON.parse(cleaned);
          recordConversationTurn(question, parsed?.reply || '', parsed?.preferenceUpdate || null);
          return parsed;
        } catch (_e) {
          recordConversationTurn(question, textOut.trim(), null);
          return { reply: textOut.trim(), action: null };
        }
      }
    } catch (e) {}
  }
  return generateSharartiTopperFallback(question);
}

export async function askGeminiAudioAPI(audioBase64, emotionContext = '', apiKey = '') {
  if (!audioBase64) return null;
  const memoryContext = getAdaptiveMemoryContext();
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audioBase64,
        emotionContext,
        memoryContext
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.transcript || data?.reply) {
        recordConversationTurn(data.transcript || '', data.reply || '', data.preferenceUpdate || null);
      }
      return data;
    }
  } catch (err) {
    console.warn('[KnowledgeEngine] /api/chat audio error:', err);
  }

  if (apiKey && apiKey.startsWith('AIza')) {
    try {
      const prompt = `System: You are Mochi, a highly conversational, intelligent, warm, curious, playful, and emotionally perceptive AI companion speaking natural Hindi or Hinglish. Never use robotic words like "Wi-Fi buffering", "2G dimaag", or "200 IQ". Listen to the user audio (in Hindi/Hinglish/English). If silence, return {"transcript":"","reply":"","action":null}. Otherwise reply in JSON: {"transcript":"what user said","reply":"natural spoken Hindi/Hinglish response","action":null}`;
      const restRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
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
        const parsed = JSON.parse(cleaned);
        if (parsed?.transcript || parsed?.reply) {
          recordConversationTurn(parsed.transcript || '', parsed.reply || '', null);
        }
        return parsed;
      }
    } catch (e) {}
  }
  return null;
}



