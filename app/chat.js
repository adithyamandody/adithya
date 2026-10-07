/* Talking to an AI with one switch.
 *
 * The constraint that shapes everything here: the user spends roughly a minute
 * composing a question, and the answer is read ALOUD to them. So a reply must
 * be short. A model that answers with six paragraphs and a bulleted list costs
 * the listener four minutes and tells them less than three sentences would.
 * Brevity is not a style preference here, it is the interface.
 *
 * Logic only — no DOM, no network — so the prompt, the history trimming and
 * the reply cleanup can be tested without a key or a connection.
 */

/* OpenAI-compatible chat endpoints. Groq and Grok both speak this shape, and
   both already have an API-key field in settings for speech, so no new
   credential is introduced.

   Models are deliberately NOT hardcoded. Hosted model names are renamed and
   retired often, and a stale id fails at the table with an unhelpful error.
   The app asks the provider what it serves and picks from that; `fallback` is
   only used if the listing cannot be fetched. */
export const CHAT_PROVIDERS = {
  groq: {
    id: 'groq',
    name: 'Groq',
    base: 'https://api.groq.com/openai/v1',
    keyField: 'groq',
    fallback: 'llama-3.3-70b-versatile',
    note: 'Fast and has a free tier. Same key as the Groq voice.',
  },
  grok: {
    id: 'grok',
    name: 'Grok (xAI)',
    base: 'https://api.x.ai/v1',
    keyField: 'grok',
    fallback: 'grok-2-latest',
    note: 'Same key as the Grok voice.',
  },
};

/** Keep only chat-capable models, newest-looking first, for the picker. */
export function pickModels(listing) {
  const rows = (listing && (listing.data || listing.models)) || [];
  return rows
    .map(r => (typeof r === 'string' ? r : r.id))
    .filter(Boolean)
    /* Speech, embedding and moderation models share the listing and will 404
       or error on a chat call, so keep them out of the picker. */
    .filter(id => !/whisper|tts|embed|guard|moderation|vision-only|distil/i.test(id))
    .sort();
}

/**
 * The system prompt.
 *
 * Every line here exists because of the user, not because of the model:
 * answers are heard, not read; the person asking may take a minute to type a
 * follow-up, so a reply that ends in a question wastes that minute; and the
 * reply is spoken by a text-to-speech voice, which reads markdown punctuation
 * out loud as symbols.
 */
export function systemPrompt(lang) {
  const language = lang === 'ml'
    ? 'Reply in Malayalam, in the Malayalam script.'
    : 'Reply in English.';
  return [
    'You are helping someone who types using a single switch, one letter at a time.',
    'A short question may have taken them a full minute to write, and your reply is',
    'read out loud to them by a speech synthesiser.',
    '',
    'Therefore:',
    '- Answer in at most three short sentences. Usually one is enough.',
    '- Lead with the answer. No preamble, no restating the question.',
    '- Plain sentences only. No markdown, no bullet points, no headings, no emoji:',
    '  the voice reads those characters aloud as symbols.',
    '- Do not ask follow-up questions unless you genuinely cannot answer without one.',
    '  A question costs them another minute of typing.',
    '- If you do not know, say so in one sentence.',
    '',
    language,
  ].join('\n');
}

/** Guess the script so the reply comes back in the language they asked in. */
export function langOf(text) {
  return /[ഀ-ൿ]/.test(String(text || '')) ? 'ml' : 'en';
}

/**
 * Build the request messages.
 *
 * `history` is the conversation so far as {role, text}. It is trimmed to the
 * last few turns: this runs on a tablet over a fair's patchy network, and a
 * long transcript makes every reply slower and more expensive for no benefit
 * in a conversation that is mostly short exchanges.
 */
export function buildMessages(history, userText, maxTurns = 6) {
  const lang = langOf(userText);
  const recent = (history || []).slice(-maxTurns);
  return [
    { role: 'system', content: systemPrompt(lang) },
    ...recent.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
    { role: 'user', content: String(userText || '').trim() },
  ];
}

/**
 * Tidy a reply before it is spoken.
 *
 * Models emit markdown even when told not to, and a speech engine reads "**"
 * and "#" aloud as characters. Strip the markup rather than trusting the
 * instruction to hold.
 */
export function cleanReply(text) {
  let s = String(text || '');
  s = s.replace(/```[\s\S]*?```/g, ' ');            // code fences read as noise
  s = s.replace(/`([^`]*)`/g, '$1');
  s = s.replace(/^\s{0,3}#{1,6}\s*/gm, '');          // headings
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/(^|\s)\*([^*]+)\*/g, '$1$2');
  s = s.replace(/^\s*[-*•]\s+/gm, '');               // bullets
  s = s.replace(/^\s*\d+\.\s+/gm, '');               // numbered lists
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');     // links: keep the words
  s = s.replace(/[ \t]{2,}/g, ' ');
  /* Removing a block leaves a line holding only a space, which then survives
     the blank-line collapse and becomes an audible pause in the middle of a
     sentence. Empty such lines before collapsing. */
  s = s.replace(/^[ \t]+$/gm, '');
  s = s.replace(/\n{2,}/g, '\n');
  return s.trim();
}

/** Why a send cannot happen, in words the user can act on. Null if it can. */
export function blockedReason({ online, provider, key, text }) {
  if (!String(text || '').trim()) return 'Nothing to ask yet — compose something first.';
  if (!provider) return 'No AI provider chosen. Settings → Chat.';
  if (!key) return `No API key for ${provider.name}. Settings → Chat.`;
  if (!online) return 'The chat needs internet. Everything else here works offline.';
  return null;
}
