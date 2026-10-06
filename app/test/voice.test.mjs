/* Voice routing.  node app/test/voice.test.mjs
 *
 * The rule that matters: a cloud provider must never be handed a script it
 * cannot speak. Deepgram has no Malayalam voice, so routing Malayalam to it
 * would produce silence or English-accented nonsense from a device somebody
 * relies on to be understood.
 */
import { PROVIDERS, scriptOf, routeFor, supportLevel } from '../voice.js';

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log(`  ok   ${n}`); }
                      catch (e) { fail++; console.log(`  FAIL ${n}\n       ${e.message}`); } };
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const ok = (c, m) => { if (!c) throw new Error(m); };

console.log('\nscript detection');
t('Malayalam text is detected as ml', () => {
  eq(scriptOf('ആദിത്യ'), 'ml');
  eq(scriptOf('എന്റെ പേര്'), 'ml');
});
t('Latin text is detected as en', () => eq(scriptOf('Adithya'), 'en'));
t('mixed text follows the Malayalam', () => eq(scriptOf('Adithya ആദിത്യ'), 'ml'));
t('digits alone do not route to English', () => eq(scriptOf('25'), 'ml'));

console.log('\nrouting — never hand a provider a script it cannot speak');
const withKeys = { voiceFor: { ml: 'deepgram', en: 'deepgram' },
                   keys: { deepgram: 'k', google: 'k', elevenlabs: 'k' } };

t('Deepgram is never used for Malayalam, even if selected', () => {
  const r = routeFor('ആദിത്യ', withKeys);
  eq(r.provider.id, 'system', 'Malayalam routed to a provider with no Malayalam voice:');
});
t('Deepgram IS used for English when selected', () => {
  eq(routeFor('Adithya', withKeys).provider.id, 'deepgram');
});
t('Google and ElevenLabs both accept Malayalam', () => {
  for (const id of ['google', 'elevenlabs'])
    eq(routeFor('ആദിത്യ', { voiceFor: { ml: id }, keys: { [id]: 'k' } }).provider.id, id, id);
});

console.log('\nfalling back');
t('a provider with no key falls back to the device voice', () => {
  eq(routeFor('ആദിത്യ', { voiceFor: { ml: 'google' }, keys: {} }).provider.id, 'system');
});
t('an unknown provider falls back rather than throwing', () => {
  eq(routeFor('ആദിത്യ', { voiceFor: { ml: 'nonesuch' }, keys: {} }).provider.id, 'system');
});
t('empty settings still route somewhere speakable', () => {
  eq(routeFor('ആദിത്യ', {}).provider.id, 'system');
});

console.log('\nthree support levels, not two');
/* Grok lists 20 languages including Hindi and Bengali but not Malayalam, while
   its docs say the model will attempt unlisted ones "with varying degrees of
   accuracy". That is neither yes nor no, and flattening it either way is wrong:
   call it no and you discard something that might work; call it yes and you
   ship a voice that may mangle the language without telling anyone. */
t('support is official, experimental, or no', () => {
  eq(supportLevel(PROVIDERS.google, 'ml'), 'official');
  eq(supportLevel(PROVIDERS.grok, 'en'), 'official');
  eq(supportLevel(PROVIDERS.grok, 'ml'), 'experimental');
  eq(supportLevel(PROVIDERS.deepgram, 'ml'), 'no');
});

t('an experimental provider IS used when chosen, and flagged', () => {
  const r = routeFor('ആദിത്യ', { voiceFor: { ml: 'grok' }, keys: { grok: 'k' } });
  eq(r.provider.id, 'grok', 'experimental support was discarded');
  eq(r.level, 'experimental', 'used without flagging it');
});

t("a provider with NO voice for the script is refused even when chosen", () => {
  const r = routeFor('ആദിത്യ', { voiceFor: { ml: 'deepgram' }, keys: { deepgram: 'k' } });
  eq(r.provider.id, 'system');
  eq(r.level, 'no');
});

t('a missing key is distinguishable from missing support', () => {
  eq(routeFor('ആദിത്യ', { voiceFor: { ml: 'google' }, keys: {} }).level, 'nokey');
});

console.log('\nprovider table');
t('every provider declares the languages it can actually speak', () => {
  for (const p of Object.values(PROVIDERS)) {
    ok(Array.isArray(p.langs) && p.langs.length, `${p.id} declares no languages`);
    for (const l of p.langs) ok(['ml', 'en'].includes(l), `${p.id}: odd language ${l}`);
  }
});
t('Deepgram declares English only — this is the fact the routing relies on', () => {
  eq(PROVIDERS.deepgram.langs.join(','), 'en');
});

/* Groq (api.groq.com, the inference provider) and Grok (api.x.ai, xAI's model)
   are different companies with different APIs and different language coverage.
   Confusing them is easy and the consequences are silent, so pin them apart. */
t('Groq and Grok are distinct providers with distinct coverage', () => {
  ok(PROVIDERS.groq && PROVIDERS.grok, 'one of them is missing');
  eq(PROVIDERS.groq.langs.join(','), 'en', 'Groq is English-only (Orpheus)');
  eq(supportLevel(PROVIDERS.groq, 'ml'), 'no', 'Groq has no Malayalam');
  eq(supportLevel(PROVIDERS.grok, 'ml'), 'experimental', 'Grok may attempt Malayalam');
  ok(PROVIDERS.groq.name.toLowerCase().includes('groq'));
  ok(PROVIDERS.grok.name.toLowerCase().includes('xai'), 'Grok should name xAI to avoid confusion');
});

t('Groq uses a voice its hosted model actually serves', () => {
  /* The open-source Orpheus voices (tara, leah, jess, leo, dan, mia, zac) are
     NOT what Groq serves; it has autumn, diana, hannah, austin, daniel, troy. */
  const groqVoices = ['autumn', 'diana', 'hannah', 'austin', 'daniel', 'troy'];
  ok(groqVoices.includes(PROVIDERS.groq.voices.en),
     `${PROVIDERS.groq.voices.en} is not a Groq-hosted Orpheus voice`);
});
t('the system voice needs no key, so there is always a fallback', () => {
  eq(PROVIDERS.system.key, false);
  ok(PROVIDERS.system.langs.includes('ml') && PROVIDERS.system.langs.includes('en'));
});
t('every cloud provider has a voice id for each language it claims or attempts', () => {
  for (const p of Object.values(PROVIDERS)) {
    if (!p.key) continue;
    for (const l of [...p.langs, ...(p.tryLangs || [])])
      ok(p.voices && p.voices[l], `${p.id} offers ${l} but has no voice id`);
  }
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
