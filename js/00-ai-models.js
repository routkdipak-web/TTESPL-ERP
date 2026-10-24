/* TTESPL ERP - central AI model registry.
   Ek hi jagah par saare Gemini model IDs. Model badalna ho to sirf yahin badlo.
   Purane (retired) IDs jaise gemini-2.5-* / gemini-2.0-* apne-aap naye model par map ho jate hain,
   isliye cloud me saved purani AI settings bhi dobara kaam karti hain. */
(function () {
  'use strict';

  var TIERS = [
    { id: 'fast',     label: 'Gemini 3.5 Flash-Lite', hint: 'Fastest answers',    model: 'gemini-3.5-flash-lite' },
    { id: 'balanced', label: 'Gemini 3.8 Flash',      hint: 'All-around help',    model: 'gemini-3.8-flash' },
    { id: 'pro',      label: 'Gemini 3.1 Pro',        hint: 'Advanced reasoning', model: 'gemini-3.1-pro-preview' },
    { id: 'argon',    label: 'Gemini 4 Argon',        hint: 'Complex tasks',      model: 'gemini-4-argon' }
  ];

  var DEFAULT_MODEL = 'gemini-3.8-flash';        // normal kaam
  var FALLBACK_MODEL = 'gemini-3.5-flash-lite';  // sabse tez / sasta backup

  /* Retired IDs -> replacement (Google ne gemini-2.5-* aur 2.0-* ko 16 Oct 2026 / pehle band kiya) */
  var LEGACY = [
    [/^gemini-(2\.0|2\.5)-flash-lite/i, 'gemini-3.5-flash-lite'],
    [/^gemini-1\.5-flash-8b/i,          'gemini-3.5-flash-lite'],
    [/^gemini-(1\.5|2\.0|2\.5)-flash/i, 'gemini-3.8-flash'],
    [/^gemini-(1\.5|2\.0|2\.5)-pro/i,   'gemini-3.1-pro-preview'],
    [/^gemini-3-pro/i,                  'gemini-3.1-pro-preview'],
    [/^gemini-3\.1-flash-lite/i,        'gemini-3.5-flash-lite']
  ];

  var ALLOWED = {};
  TIERS.forEach(function (t) { ALLOWED[t.model] = t; });

  /* Koi bhi model string -> ek valid, current model ID. Unknown 'gemini-*' (future IDs) allow, baaki default. */
  function resolve(model) {
    var m = String(model == null ? '' : model).trim().replace(/^models\//, '');
    if (!m) return DEFAULT_MODEL;
    if (ALLOWED[m]) return m;
    for (var i = 0; i < LEGACY.length; i++) if (LEGACY[i][0].test(m)) return LEGACY[i][1];
    return /^gemini-[a-z0-9.\-]+$/i.test(m) ? m : DEFAULT_MODEL;
  }

  /* tier id ('fast' | 'balanced' | 'pro' | 'argon') ya model string -> model ID */
  function pick(tierOrModel) {
    for (var i = 0; i < TIERS.length; i++) if (TIERS[i].id === tierOrModel) return TIERS[i].model;
    return resolve(tierOrModel);
  }

  function labelOf(model) { var t = ALLOWED[resolve(model)]; return t ? t.label : String(model); }

  /* Provider reply se sirf asli jawab nikalo ('thought' parts chhod do) */
  function textOf(data) {
    var c = data && data.candidates && data.candidates[0];
    var parts = (c && c.content && c.content.parts) || [];
    return parts.filter(function (p) { return p && !p.thought; }).map(function (p) { return p.text || ''; }).join('').trim();
  }

  window.TT_AI_MODELS = {
    tiers: TIERS, defaultModel: DEFAULT_MODEL, fallbackModel: FALLBACK_MODEL,
    resolve: resolve, pick: pick, labelOf: labelOf, textOf: textOf
  };
})();
