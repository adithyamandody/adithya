/* Speech output.
 *
 * The device speaks offline by default, through the system voice, and that
 * stays the fallback for everything. Cloud voices are an optional upgrade:
 * better sounding, but they need a network, and a person who cannot talk
 * losing their voice because WiFi dropped is not an acceptable failure.
 *
 * So every cloud result is CACHED. A phrase is fetched once and plays from
 * local storage forever after — instantly, offline, at no further cost. The
 * network is needed to learn a sentence, never to say one again.
 *
 * Language routing matters more than vendor choice here: Deepgram's Aura has
 * no Malayalam voice at all (English, Spanish, German, French, Dutch, Italian,
 * Japanese only), so it is the ENGLISH engine. Malayalam has to come from a
 * provider that actually speaks it.
 */

export const PROVIDERS = {
  system: {
    id: 'system',
    name: 'Device voice (offline)',
    langs: ['ml', 'en'],
    key: false,
    offline: true,
    note: 'Whatever the tablet has installed. No network, no cost, no cache.',
  },
  google: {
    id: 'google',
    name: 'Google Cloud TTS',
    langs: ['ml', 'en'],
    key: 'API key',
    voices: { ml: 'ml-IN-Wavenet-C', en: 'en-IN-Wavenet-D' },
    note: 'Has real Malayalam voices (ml-IN-Wavenet-C / D). Cheapest per character.',
  },
  /* Declared English-official and Malayalam-EXPERIMENTAL, which is a
     correction. This claimed official Malayalam while calling
     eleven_multilingual_v2, and that model's 29 languages include Tamil but
     NOT Malayalam. The declaration is what routeFor trusts, so the mismatch
     disabled the very guard meant to stop a provider speaking a script it
     cannot — the same three-state problem as Grok, so treat it the same way:
     offer it, label it, never choose it automatically.

     ElevenLabs' later v3 model does list Malayalam. Switching would need the
     model id and its availability checked against their current docs, so it
     is deliberately not done blind here. */
  elevenlabs: {
    id: 'elevenlabs',
    name: 'ElevenLabs (experimental Malayalam)',
    langs: ['en'],
    tryLangs: ['ml'],
    key: 'API key',
    model: 'eleven_multilingual_v2',
    voices: { ml: 'JBFqnCBsd6RMkjVDRZzb', en: 'JBFqnCBsd6RMkjVDRZzb' },
    note: 'Most natural sounding in English. Malayalam is not among this '
        + "model's 29 languages — it will attempt it, so judge the result.",
  },
  deepgram: {
    id: 'deepgram',
    name: 'Deepgram Aura',
    langs: ['en'],                       // no Malayalam voice exists
    key: 'API key',
    voices: { en: 'aura-2-thalia-en' },
    note: 'English only — Aura has no Malayalam voice. Used for the ABC layer.',
  },
  /* Groq and Grok are different companies and this is an easy mistake to make:
     Groq is the LPU inference provider (api.groq.com), Grok is xAI's model
     (api.x.ai). Both have a TTS API and they behave quite differently, so the
     UI spells out which is which. */
  groq: {
    id: 'groq',
    name: 'Groq — Orpheus (English only)',
    langs: ['en'],
    key: 'API key',
    model: 'canopylabs/orpheus-v1-english',
    /* Groq's hosted voices are NOT the open-source Orpheus ones. tara, leah,
       jess and so on belong to the Canopy AI release; the Groq deployment
       serves autumn, diana, hannah, austin, daniel and troy. */
    voices: { en: 'hannah' },
    note: 'English and Arabic only — PlayAI was retired at the end of 2025, '
        + 'leaving two Orpheus models. No Indian languages.',
  },
  grok: {
    id: 'grok',
    name: 'Grok — xAI (experimental Malayalam)',
    langs: ['en'],
    /* Grok lists 20 languages including Hindi and Bengali, but NOT Malayalam.
       Its docs say the model "is capable of generating speech in additional
       languages beyond those listed, with varying degrees of accuracy" — so
       Malayalam is neither supported nor refused. That is a third state, and
       flattening it into yes/no would either throw away something that might
       work or quietly ship a voice that mangles the language. It is offered,
       labelled, and never chosen automatically. */
    tryLangs: ['ml'],
    key: 'API key',
    voices: { en: 'eve', ml: 'eve' },
    note: 'Officially English, Hindi, Bengali and 17 more — Malayalam is not on '
        + 'the list but the model will attempt it. Try it and judge for yourself.',
  },
};

/** Does this provider speak this script, and how confidently? */
export function supportLevel(provider, lang) {
  if (!provider) return 'no';
  if (provider.langs.includes(lang)) return 'official';
  if ((provider.tryLangs || []).includes(lang)) return 'experimental';
  return 'no';
}

/* ── what can this device actually say? ───────────────────────────────────
 * Finding Android's text-to-speech screen depends on brand and version, and a
 * missing Malayalam voice is the failure that silences a demo. So rather than
 * sending someone hunting through Settings, ask the device.
 */

/** getVoices() is empty on the first call in Chrome and fills in later, so a
 *  naive check reports "no voices" on a tablet that has plenty. Wait for the
 *  event, with a timeout for the engines that never fire it. */
export function listVoices(timeout = 1500) {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return resolve([]);
    const synth = window.speechSynthesis;
    const first = synth.getVoices();
    if (first && first.length) return resolve(first);

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(synth.getVoices() || []);
    };
    synth.addEventListener?.('voiceschanged', finish, { once: true });
    setTimeout(finish, timeout);
  });
}

/** Classify a voice list. Pure, so it is tested without a browser.
 *
 *  `local` matters as much as presence: a voice that only exists as a network
 *  voice goes silent in aeroplane mode, which is the condition at the venue. */
export function describeVoices(voices) {
  const all = (voices || []).map(v => ({
    name: v.name || '(unnamed)',
    lang: String(v.lang || '').replace(/_/g, '-'),
    local: v.localService !== false,          // absent means assume on-device
  }));
  const of = re => all.filter(v => re.test(v.lang));
  const ml = of(/^ml(-|$)/i);
  const en = of(/^en(-|$)/i);
  const offlineMl = ml.filter(v => v.local);

  const verdict = all.length === 0        ? 'no-engine'
                : ml.length === 0         ? 'no-malayalam'
                : offlineMl.length === 0  ? 'malayalam-needs-network'
                : 'ok';

  return { total: all.length, all, ml, en, offlineMl,
           hasMalayalam: ml.length > 0, hasOfflineMalayalam: offlineMl.length > 0,
           verdict };
}

/** Which script is this? Routing depends on it, not on a user setting. */
export function scriptOf(text) {
  if (/[ഀ-ൿ]/.test(text)) return 'ml';
  if (/[A-Za-z]/.test(text)) return 'en';
  return 'ml';                            // digits and punctuation: read as Malayalam
}

/* ── cache ────────────────────────────────────────────────────────────────
 * IndexedDB rather than localStorage: audio blobs are far past the ~5 MB
 * string quota, and blobs survive without base64 inflation.
 */
const DB = 'aksharascan-voice';
let dbp = null;

function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('clips');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}

const cacheKey = (text, provider, voice) => `${provider}|${voice}|${text}`;

export async function cacheGet(key) {
  try {
    const d = await db();
    return await new Promise((res, rej) => {
      const r = d.transaction('clips').objectStore('clips').get(key);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  } catch (_) { return null; }
}

export async function cachePut(key, blob) {
  try {
    const d = await db();
    await new Promise((res, rej) => {
      const t = d.transaction('clips', 'readwrite');
      t.objectStore('clips').put(blob, key);
      t.oncomplete = res;
      t.onerror = () => rej(t.error);
    });
    return true;
  } catch (_) { return false; }
}

export async function cacheStats() {
  try {
    const d = await db();
    return await new Promise((res, rej) => {
      const r = d.transaction('clips').objectStore('clips').count();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  } catch (_) { return 0; }
}

export async function cacheClear() {
  try {
    const d = await db();
    await new Promise(res => {
      const t = d.transaction('clips', 'readwrite');
      t.objectStore('clips').clear();
      t.oncomplete = res;
    });
    return true;
  } catch (_) { return false; }
}

/* ── the providers ────────────────────────────────────────────────────── */

async function fetchDeepgram(text, key, voice) {
  const r = await fetch(
    `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(voice)}`,
    { method: 'POST',
      headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }) });
  if (!r.ok) throw new Error(`Deepgram ${r.status}: ${(await r.text()).slice(0, 120)}`);
  return r.blob();
}

async function fetchGoogle(text, key, voice) {
  const r = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`,
    { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: voice.split('-').slice(0, 2).join('-'), name: voice },
        audioConfig: { audioEncoding: 'MP3' },
      }) });
  if (!r.ok) throw new Error(`Google ${r.status}: ${(await r.text()).slice(0, 120)}`);
  const j = await r.json();
  if (!j.audioContent) throw new Error('Google returned no audioContent');
  const bytes = Uint8Array.from(atob(j.audioContent), c => c.charCodeAt(0));
  return new Blob([bytes], { type: 'audio/mpeg' });
}

async function fetchGrok(text, key, voice, lang) {
  const r = await fetch('https://api.x.ai/v1/tts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice_id: voice,
      /* 'auto' rather than 'ml': Malayalam is not on the supported list, and
         asking for an unlisted code is more likely to be refused than letting
         the model detect the script itself. */
      language: lang === 'ml' ? 'auto' : 'en',
      output_format: { codec: 'mp3' },
    }),
  });
  if (!r.ok) throw new Error(`Grok ${r.status}: ${(await r.text()).slice(0, 120)}`);
  return r.blob();
}

async function fetchGroq(text, key, voice) {
  const r = await fetch('https://api.groq.com/openai/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: PROVIDERS.groq.model,
      voice,
      input: text,
      response_format: 'wav',
    }),
  });
  if (!r.ok) throw new Error(`Groq ${r.status}: ${(await r.text()).slice(0, 120)}`);
  return r.blob();
}

async function fetchElevenLabs(text, key, voice) {
  /* Read the model from the provider entry rather than repeating it here:
     the declared language support is only meaningful if it describes the
     model actually called, and two copies of a model id drift. */
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`,
    { method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: PROVIDERS.elevenlabs.model }) });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 120)}`);
  return r.blob();
}

const FETCHERS = { deepgram: fetchDeepgram, google: fetchGoogle,
                   elevenlabs: fetchElevenLabs, grok: fetchGrok, groq: fetchGroq };

/* ── routing and playback ─────────────────────────────────────────────── */

/** Pick a provider that can actually speak this script. */
export function routeFor(text, settings) {
  const lang = scriptOf(text);
  const want = (settings.voiceFor || {})[lang] || 'system';
  const p = PROVIDERS[want];
  const level = supportLevel(p, lang);

  /* 'no' means the provider has no voice for this script at all. Using it
     anyway would produce silence or confident nonsense from a device somebody
     relies on to be understood, so fall back regardless of the setting. */
  if (level === 'no') return { provider: PROVIDERS.system, lang, level: 'no' };
  if (p.key && !(settings.keys || {})[p.id]) {
    return { provider: PROVIDERS.system, lang, level: 'nokey' };
  }
  return { provider: p, lang, level };
}

let current = null;

function playBlob(blob) {
  return new Promise((res, rej) => {
    if (current) { current.pause(); URL.revokeObjectURL(current.src); }
    const a = new Audio(URL.createObjectURL(blob));
    current = a;
    a.onended = () => { URL.revokeObjectURL(a.src); res(); };
    a.onerror = () => rej(new Error('audio playback failed'));
    a.play().catch(rej);
  });
}

function speakSystem(text, lang) {
  if (!('speechSynthesis' in window)) throw new Error('no speech synthesis on this device');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'en' ? 'en-IN' : 'ml-IN';
  const v = speechSynthesis.getVoices().find(x => x.lang.toLowerCase().startsWith(lang === 'en' ? 'en' : 'ml'));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
  return { provider: 'system', cached: false, voice: v ? v.name : null };
}

/**
 * Say it. Cache first, network only if needed, system voice if anything fails.
 * `prefetch` renders and caches without playing — used to warm the phrase list.
 */
export async function say(text, settings, { prefetch = false } = {}) {
  text = (text || '').trim();
  if (!text) return { ok: false, why: 'nothing to say' };

  const { provider, lang, level } = routeFor(text, settings);

  if (provider.id === 'system') {
    if (prefetch) return { ok: true, provider: 'system', cached: false, prefetch: true };
    try { return { ok: true, ...speakSystem(text, lang) }; }
    catch (e) { return { ok: false, why: e.message }; }
  }

  const voice = provider.voices[lang];
  const key = cacheKey(text, provider.id, voice);

  const hit = await cacheGet(key);
  if (hit) {
    if (prefetch) return { ok: true, provider: provider.id, cached: true };
    await playBlob(hit);
    return { ok: true, provider: provider.id, cached: true };
  }

  try {
    const blob = await FETCHERS[provider.id](text, settings.keys[provider.id], voice, lang);
    await cachePut(key, blob);
    if (!prefetch) await playBlob(blob);
    return { ok: true, provider: provider.id, cached: false, level };
  } catch (e) {
    /* Network down, key wrong, CORS refused, quota gone — it does not matter
       which. The person still needs to be heard, so fall through to the voice
       that cannot fail. */
    if (prefetch) return { ok: false, why: e.message, provider: provider.id };
    try {
      const r = speakSystem(text, lang);
      return { ok: true, ...r, fellBack: true, why: e.message };
    } catch (e2) {
      return { ok: false, why: `${e.message}; and no system voice (${e2.message})` };
    }
  }
}
