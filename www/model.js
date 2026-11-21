// Divorcy risk model.
//
// A survival model fitted on the "How Couples Meet and Stay Together" survey
// (HCMST, Stanford, 2009-2017): about 2,600 US couples followed for up to eight
// years. training/train.py fits it and writes coefficients.js; this file only
// applies those numbers. Each answer multiplies the couple's yearly breakup
// rate, and the yearly rates are added up into a five-year probability.
//
// One question is NOT from the fitted model: the monogamy question. The survey
// asked it only in 2014, and just 23 non-monogamous couples were followed
// afterwards (4 broke up by 2017, against 16 of 574 monogamous couples). That is
// too few to fit, so its weight below is set by hand.
(function (root) {
  'use strict';

  const DATA = typeof module !== 'undefined' && module.exports
    ? require('./coefficients.js') : root.DivorcyCoefficients;
  const B = DATA.coefficients;

  const HORIZON_YEARS = 5;
  const NON_MONOGAMY_RATE_RATIO = 2.0; // hand-set, see note above

  // type "choice": the answer is an option index; `value` is what the model sees.
  // type "number": the answer is the number itself.
  const QUESTIONS = [
    { id: 'married', section: 'Your relationship', label: 'Married',
      text: 'Are you married to your partner?', type: 'choice',
      options: [['Yes', 1], ['No', 0]] },
    { id: 'coresident', section: 'Your relationship', label: 'Living together',
      text: 'Do you live together?', type: 'choice',
      options: [['Yes', 1], ['No', 0]] },
    { id: 'duration', section: 'Your relationship', label: 'Years together',
      text: 'How many years have you been a couple?', type: 'number', min: 0, max: 80 },
    { id: 'quality', section: 'Your relationship', label: 'Relationship quality',
      text: 'In general, how would you describe the quality of your relationship?', type: 'choice',
      options: [['Excellent', 0], ['Good', 1], ['Fair', 2], ['Poor', 3], ['Very poor', 4]] },
    { id: 'monogamy', section: 'Your relationship', label: 'Monogamy',
      text: 'Do you expect your partner to have sex only with you?', type: 'choice',
      options: [['Yes', 0], ['No, we have an open relationship', 1]] },

    { id: 'age', section: 'About you', label: 'Your age',
      text: 'How old are you?', type: 'number', min: 18, max: 99 },
    { id: 'education', section: 'About you', label: 'Your education',
      text: 'What is the highest level of school you have completed?', type: 'choice',
      options: [['Less than high school', 10], ['High school', 12], ['Some college', 14],
                ['Bachelor’s degree', 16], ['Graduate degree', 18]] },
    { id: 'prior', section: 'About you', label: 'Married before',
      text: 'Had you been married to someone else before this relationship?', type: 'choice',
      options: [['No', 0], ['Yes', 1]] },
  ];

  function validate(answers) {
    const v = {};
    for (const q of QUESTIONS) {
      const a = answers[q.id];
      const ok = q.type === 'choice'
        ? Number.isInteger(a) && a >= 0 && a < q.options.length
        : typeof a === 'number' && a >= q.min && a <= q.max;
      if (!ok) throw new Error('Missing or invalid answer for "' + q.id + '"');
      v[q.id] = q.type === 'choice' ? q.options[a][1] : a;
    }
    return v;
  }

  // Model inputs for a couple `yearsAhead` years from now (they age, and so does the relationship).
  function features(v, yearsAhead) {
    const logDuration = Math.log1p(v.duration + yearsAhead);
    return {
      married: v.married,
      coresident: v.coresident,
      bad_quality: v.quality,
      log_duration: logDuration,
      age10: (v.age + yearsAhead) / 10,
      years_education: v.education,
      prior_marriage: v.prior,
      married_x_log_duration: v.married * logDuration,
    };
  }

  const logRate = (x) => Object.keys(B).reduce((sum, k) => sum + B[k] * x[k], DATA.intercept);

  // Chance of breaking up within HORIZON_YEARS, from yearly rates. `featuresAt(k)` gives year k's inputs.
  function probability(featuresAt, rateRatio) {
    let cumulative = 0;
    for (let k = 0; k < HORIZON_YEARS; k++) cumulative += Math.exp(logRate(featuresAt(k))) * rateRatio;
    return 1 - Math.exp(-cumulative);
  }

  // The average couple of the same marital status in the survey, aged forward the same way.
  function referenceFeatures(mean, yearsAhead) {
    const logDuration = Math.log1p(Math.expm1(mean.log_duration) + yearsAhead);
    return { ...mean, log_duration: logDuration, age10: mean.age10 + yearsAhead / 10,
             married_x_log_duration: mean.married * logDuration };
  }

  // answers: { [questionId]: number }. Every question must be answered.
  function predict(answers) {
    const v = validate(answers);
    const mean = DATA.means[v.married ? 'married' : 'unmarried'];
    const now = features(v, 0);
    const ratio = v.monogamy ? NON_MONOGAMY_RATE_RATIO : 1;

    // How far each answer moves the log rate away from the average couple.
    const delta = (k) => B[k] * (now[k] - mean[k]);
    const factors = [
      { id: 'coresident', contribution: delta('coresident') },
      { id: 'duration', contribution: delta('log_duration') + delta('married_x_log_duration') },
      { id: 'quality', contribution: delta('bad_quality') },
      { id: 'monogamy', contribution: Math.log(ratio) },
      { id: 'age', contribution: delta('age10') },
      { id: 'education', contribution: delta('years_education') },
      { id: 'prior', contribution: delta('prior_marriage') },
    ].map((f) => ({ ...f, label: QUESTIONS.find((q) => q.id === f.id).label }))
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    const p = probability((k) => features(v, k), ratio);
    const band = p < 0.05 ? 'Low' : p < 0.15 ? 'Moderate' : p < 0.35 ? 'Elevated' : 'High';
    return {
      probability: p,
      band,
      married: v.married === 1,
      typical: probability((k) => referenceFeatures(mean, k), 1),
      factors,
    };
  }

  const api = { QUESTIONS, HORIZON_YEARS, NON_MONOGAMY_RATE_RATIO, DATA, predict };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Divorcy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
