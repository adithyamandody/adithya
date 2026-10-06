/* Voice routing.  node app/test/voice.test.mjs
 *
 * The rule that matters: a cloud provider must never be handed a script it
 * cannot speak. Deepgram has no Malayalam voice, so routing Malayalam to it
 * would produce silence or English-accented nonsense from a device somebody
 * relies on to be understood.
 */
import { PROVIDERS, scriptOf, routeFor, supportLevel, describeVoices, pickBackend, BCP47 } from '../voice.js';

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

/* The whole point of this app is Malayalam, so claiming official Malayalam is
   the one declaration that must not be wrong. routeFor trusts `langs` and will
   send a Malayalam sentence straight to anything listed there — so an
   overclaim does not fail loudly, it speaks nonsense to someone relying on it
   to be understood.

   ElevenLabs claimed official Malayalam while calling eleven_multilingual_v2,
   whose 29 languages include Tamil and not Malayalam. The existing tests
   passed because they only checked that `langs` held valid codes, never
   whether the model behind it speaks them. This is the missing invariant. */
const MAY_CLAIM_ML = ['system', 'google'];
t('only providers with documented Malayalam voices claim it officially', () => {
  for (const p of Object.values(PROVIDERS)) {
    if (supportLevel(p, 'ml') !== 'official') continue;
    ok(MAY_CLAIM_ML.includes(p.id),
       `${p.id} claims OFFICIAL Malayalam. If that is genuinely documented, `
       + 'add it to MAY_CLAIM_ML with the voice id; otherwise use tryLangs.');
  }
});

t('ElevenLabs Malayalam is experimental, matching the model it calls', () => {
  eq(PROVIDERS.elevenlabs.model, 'eleven_multilingual_v2',
     'if the model changed, re-check its language list before relaxing this');
  eq(supportLevel(PROVIDERS.elevenlabs, 'en'), 'official');
  eq(supportLevel(PROVIDERS.elevenlabs, 'ml'), 'experimental',
     'multilingual_v2 does not list Malayalam, so it cannot be official');
});

/* Google is the only cloud provider that genuinely speaks Malayalam, which
   makes it the one that must keep working. */
t('Google has a real Malayalam voice id', () => {
  eq(supportLevel(PROVIDERS.google, 'ml'), 'official');
  ok(/^ml-IN-/.test(PROVIDERS.google.voices.ml),
     `expected an ml-IN voice, got ${PROVIDERS.google.voices.ml}`);
});

/* Offline is the floor: a person losing their voice because WiFi dropped is
   not an acceptable failure, so the fallback must never need a key. */
t('the offline fallback speaks Malayalam and needs no key', () => {
  eq(supportLevel(PROVIDERS.system, 'ml'), 'official');
  eq(PROVIDERS.system.key, false);
  ok(PROVIDERS.system.offline);
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

/* ── the device voice check ───────────────────────────────────────────────
 * A missing Malayalam voice is the failure that silences the demo, and the
 * Android screen that fixes it sits somewhere different on every brand. The
 * app reports it instead, so the reporting has to be right.
 */
const V = (lang, name, local = true) => ({ lang, name, localService: local });

t('no voices at all is reported as no engine', () => {
  const d = describeVoices([]);
  eq(d.verdict, 'no-engine');
  eq(d.total, 0);
  eq(d.hasMalayalam, false);
});

t('a null list does not throw', () => {
  eq(describeVoices(null).verdict, 'no-engine');
  eq(describeVoices(undefined).total, 0);
});

t('English but no Malayalam is reported as such', () => {
  const d = describeVoices([V('en-IN', 'English India'), V('en-US', 'English US')]);
  eq(d.verdict, 'no-malayalam');
  eq(d.en.length, 2);
  eq(d.ml.length, 0);
});

t('an offline Malayalam voice is the pass case', () => {
  const d = describeVoices([V('ml-IN', 'Malayalam India'), V('en-US', 'English US')]);
  eq(d.verdict, 'ok');
  eq(d.hasOfflineMalayalam, true);
  eq(d.ml.length, 1);
});

/* The one that matters most: present in the list, but silent in aeroplane
   mode. Treating this as a pass would mean discovering it at the venue. */
t('a network-only Malayalam voice is NOT a pass', () => {
  const d = describeVoices([V('ml-IN', 'Malayalam Network', false)]);
  eq(d.hasMalayalam, true, 'it is present...');
  eq(d.hasOfflineMalayalam, false, '...but not offline');
  eq(d.verdict, 'malayalam-needs-network');
});

t('one offline voice among network ones is still a pass', () => {
  const d = describeVoices([V('ml-IN', 'Net', false), V('ml-IN', 'Local', true)]);
  eq(d.verdict, 'ok');
  eq(d.offlineMl.length, 1);
});

/* Android reports ml_IN with an underscore in places, and bare "ml" exists. */
t('underscores and bare language codes are recognised', () => {
  eq(describeVoices([V('ml_IN', 'underscore')]).verdict, 'ok');
  eq(describeVoices([V('ml', 'bare')]).verdict, 'ok');
  eq(describeVoices([V('ML-IN', 'shouty')]).verdict, 'ok');
});

/* Malay is a different language with a confusingly close code. Counting it as
   Malayalam would report success on a device that cannot speak a word of it. */
t('Malay (ms) is not mistaken for Malayalam (ml)', () => {
  const d = describeVoices([V('ms-MY', 'Bahasa Melayu')]);
  eq(d.ml.length, 0, 'ms-MY must not count as Malayalam');
  eq(d.verdict, 'no-malayalam');
});

t('a missing localService is assumed on-device', () => {
  const d = describeVoices([{ lang: 'ml-IN', name: 'no flag' }]);
  eq(d.verdict, 'ok', 'absent localService should not be read as network-only');
});

t('a voice with no name does not blank the report', () => {
  eq(describeVoices([{ lang: 'ml-IN' }]).ml[0].name, '(unnamed)');
});


/* ── which door to the device voice ───────────────────────────────────────
 * Android's System WebView does not expose window.speechSynthesis, so inside
 * the APK the Web Speech API is absent and the app threw "no speech synthesis
 * on this device" no matter how many voices were installed. Chrome for Android
 * has it. Same tablet, same voices, different result — so the choice of
 * backend decides whether the app can speak at all, and it is worth pinning.
 */
t('a plain browser with speech uses the Web Speech API', () => {
  eq(pickBackend({ speechSynthesis: {} }), 'web');
});

t('a browser without speech has no route', () => {
  eq(pickBackend({}), 'none');
  eq(pickBackend(null), 'none');
  eq(pickBackend(undefined), 'none');
});

/* The case that was broken: native shell, no Web Speech API. */
t('the APK uses the native plugin even with no speechSynthesis', () => {
  const win = { Capacitor: { isNativePlatform: () => true } };
  eq(pickBackend(win), 'native', 'the APK must not fall back to a missing Web Speech API');
});

t('native wins over Web Speech when both look available', () => {
  const win = { speechSynthesis: {}, Capacitor: { isNativePlatform: () => true } };
  eq(pickBackend(win), 'native', 'native voices are the ones the user installed');
});

/* A Capacitor web build carries the global but is not native. Reading
   presence as nativeness would route browser users at a plugin that is not
   there. */
t('a Capacitor global alone does not mean native', () => {
  const win = { speechSynthesis: {}, Capacitor: { isNativePlatform: () => false } };
  eq(pickBackend(win), 'web');
});

t('a bridge without isNativePlatform is trusted if the plugin is registered', () => {
  eq(pickBackend({ Capacitor: { Plugins: { TextToSpeech: {} } } }), 'native');
  eq(pickBackend({ Capacitor: { Plugins: {} } }), 'none');
});

/* Android wants a BCP 47 tag, not the two-letter code used internally. */
t('language codes map to BCP 47 tags Android accepts', () => {
  eq(BCP47.ml, 'ml-IN');
  eq(BCP47.en, 'en-IN');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
