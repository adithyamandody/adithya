/* Tests for the AI chat.  node app/test/chat.test.mjs
 *
 * The thing being protected here is not the API call, it is the SHAPE of what
 * comes back. A reply is read aloud to someone who took a minute to type the
 * question, so a six-paragraph answer with bullet points is a failure even
 * when it is correct — the voice reads the asterisks out as "asterisk".
 */
import {
  CHAT_PROVIDERS, pickModels, systemPrompt, langOf, buildMessages,
  cleanReply, blockedReason,
} from '../chat.js';

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ok   ${name}`); }
  catch (e) { fail++; console.log(`  FAIL ${name}\n       ${e.message}`); }
};
const eq = (a, b, m = '') => {
  if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, m) => { if (!c) throw new Error(m); };

console.log('\nproviders\n');

t('every provider is OpenAI-shaped and reuses an existing key', () => {
  for (const p of Object.values(CHAT_PROVIDERS)) {
    ok(/^https:\/\//.test(p.base), `${p.id} base must be https`);
    ok(p.base.endsWith('/v1'), `${p.id} should point at an OpenAI-compatible /v1`);
    ok(p.keyField, `${p.id} has no key field`);
    ok(p.fallback, `${p.id} needs a fallback model for when the listing fails`);
  }
});

/* Hosted model names get retired. A stale hardcoded id fails at the table
   with an unhelpful error, so the app asks what is served. */
t('the model listing is filtered to chat-capable models', () => {
  const got = pickModels({ data: [
    { id: 'llama-3.3-70b-versatile' },
    { id: 'whisper-large-v3' },
    { id: 'text-embedding-3-small' },
    { id: 'playai-tts' },
    { id: 'llama-guard-4-12b' },
  ]});
  ok(got.includes('llama-3.3-70b-versatile'), 'dropped the chat model');
  ok(!got.includes('whisper-large-v3'), 'speech-to-text is not a chat model');
  ok(!got.includes('text-embedding-3-small'), 'embeddings are not a chat model');
  ok(!got.includes('playai-tts'), 'tts is not a chat model');
  ok(!got.includes('llama-guard-4-12b'), 'a guard model is not for chatting');
});

t('a listing of plain strings also works', () => {
  ok(pickModels({ models: ['some-chat-model'] }).includes('some-chat-model'));
});

t('a missing or broken listing does not throw', () => {
  eq(pickModels(null).length, 0);
  eq(pickModels({}).length, 0);
  eq(pickModels({ data: [{ nope: 1 }] }).length, 0);
});

console.log('\nthe prompt\n');

/* Each of these lines is in the prompt because of the user, not the model. */
t('the prompt demands brevity and forbids markdown', () => {
  const p = systemPrompt('en');
  ok(/three short sentences/i.test(p), 'must cap the length');
  ok(/no markdown/i.test(p), 'markdown is read aloud as symbols');
  ok(/single switch/i.test(p), 'the model should know who it is talking to');
  ok(/follow-up/i.test(p), 'a question costs the user another minute');
});

t('the prompt asks for Malayalam when the question is Malayalam', () => {
  ok(/Malayalam script/i.test(systemPrompt('ml')));
  ok(/English/i.test(systemPrompt('en')));
});

t('the language is detected from the question, not a setting', () => {
  eq(langOf('ഞാൻ ആദിത്യ'), 'ml');
  eq(langOf('what is the time'), 'en');
  eq(langOf(''), 'en');
  eq(langOf(null), 'en');
});

console.log('\nbuilding the request\n');

t('a request carries the system prompt and the question', () => {
  const m = buildMessages([], 'what is a scan tree');
  eq(m[0].role, 'system');
  eq(m[m.length - 1].role, 'user');
  eq(m[m.length - 1].content, 'what is a scan tree');
});

t('history is included and roles are mapped', () => {
  const m = buildMessages([{ role: 'user', text: 'hello' }, { role: 'ai', text: 'hi' }], 'more');
  eq(m[1].content, 'hello');
  eq(m[2].role, 'assistant', 'our "ai" must become the API\'s "assistant"');
});

/* A long transcript makes every reply slower on a patchy fair network and
   buys nothing in short exchanges. */
t('history is trimmed to the recent turns', () => {
  const long = Array.from({ length: 50 }, (_, i) => ({ role: 'user', text: 'm' + i }));
  const m = buildMessages(long, 'now', 6);
  eq(m.length, 8, 'system + 6 turns + the new question');
  eq(m[1].content, 'm44', 'should keep the LAST six, not the first');
});

t('a Malayalam question produces a Malayalam system prompt', () => {
  const m = buildMessages([], 'സുഖമാണോ');
  ok(/Malayalam/i.test(m[0].content));
});

console.log('\ncleaning the reply\n');

/* Models emit markdown even when told not to, and the voice reads it aloud. */
t('bold and italics lose their markers', () => {
  eq(cleanReply('This is **important** and *this* too'), 'This is important and this too');
});

t('bullets and numbered lists become plain lines', () => {
  eq(cleanReply('- one\n- two'), 'one\ntwo');
  eq(cleanReply('1. first\n2. second'), 'first\nsecond');
});

t('headings lose their hashes', () => {
  eq(cleanReply('## Heading\ntext'), 'Heading\ntext');
});

t('links keep their words and lose the URL', () => {
  eq(cleanReply('see [the docs](https://example.com) now'), 'see the docs now');
});

t('code fences are removed rather than read out', () => {
  eq(cleanReply('before\n```js\nconst x = 1;\n```\nafter'), 'before\nafter');
});

t('inline code keeps the word', () => {
  eq(cleanReply('use `npm test` here'), 'use npm test here');
});

t('ordinary text is untouched', () => {
  eq(cleanReply('Just a normal sentence.'), 'Just a normal sentence.');
});

t('Malayalam survives cleaning', () => {
  eq(cleanReply('**ഞാൻ ആദിത്യ**'), 'ഞാൻ ആദിത്യ');
});

t('empty input does not throw', () => {
  eq(cleanReply(''), '');
  eq(cleanReply(null), '');
});

console.log('\nwhy a send is blocked\n');

const P = CHAT_PROVIDERS.groq;

t('each blocker is reported in words the user can act on', () => {
  ok(/compose/i.test(blockedReason({ online: true, provider: P, key: 'k', text: '  ' })));
  ok(/provider/i.test(blockedReason({ online: true, provider: null, key: 'k', text: 'hi' })));
  ok(/API key/i.test(blockedReason({ online: true, provider: P, key: '', text: 'hi' })));
  ok(/internet/i.test(blockedReason({ online: false, provider: P, key: 'k', text: 'hi' })));
});

/* The offline message has to make clear that only chat is affected, or it
   reads as "the app needs internet", which is the opposite of true. */
t('the offline message says the rest still works', () => {
  ok(/offline/i.test(blockedReason({ online: false, provider: P, key: 'k', text: 'hi' })),
     'must reassure that everything else works offline');
});

t('nothing blocks a valid send', () => {
  eq(blockedReason({ online: true, provider: P, key: 'k', text: 'hello' }), null);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
