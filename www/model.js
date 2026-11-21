// Divorcy risk model.
//
// A transparent additive log-odds model: start from a baseline risk, then each
// answer multiplies the odds by a factor. The factors are hand-set
// approximations of the direction and rough size of effects reported in
// marriage research (demographic studies of divorce, and Gottman's work on
// conflict behaviour). They are NOT fitted to a dataset, so the output is an
// educational estimate, not a calibrated probability.
(function (root) {
  'use strict';

  // Risk for a couple who picks the reference answer on every question.
  const BASELINE = 0.38;

  const FREQ = ['Never', 'Rarely', 'Sometimes', 'Often', 'Almost always'];

  // type "choice": each option carries its own odds ratio (1 = reference).
  // type "scale":  answer 0..4 on FREQ; `or` is the odds ratio at the top of the
  //                scale relative to the midpoint (below 1 = protective).
  const QUESTIONS = [
    // --- Background -------------------------------------------------------
    { id: 'age', section: 'Background', label: 'Age at marriage',
      text: 'How old was the younger partner when you married?', type: 'choice',
      options: [['Under 20', 2.0], ['20–24', 1.4], ['25–32', 1.0], ['33 or older', 1.15]] },
    { id: 'education', section: 'Background', label: 'Education',
      text: 'What is the highest education level between the two of you?', type: 'choice',
      options: [['High school or less', 1.25], ['Some college / vocational', 1.0], ['University degree or higher', 0.75]] },
    { id: 'parents', section: 'Background', label: 'Parental divorce',
      text: 'Did either partner’s parents divorce?', type: 'choice',
      options: [['Neither', 1.0], ['One partner’s parents', 1.3], ['Both partners’ parents', 1.6]] },
    { id: 'prior', section: 'Background', label: 'Previous marriages',
      text: 'Has either partner been married before?', type: 'choice',
      options: [['No', 1.0], ['One of us', 1.3], ['Both of us', 1.5]] },
    { id: 'courtship', section: 'Background', label: 'Time together before marriage',
      text: 'How long were you together before marrying?', type: 'choice',
      options: [['Less than 1 year', 1.25], ['1–3 years', 1.0], ['More than 3 years', 0.85]] },
    { id: 'money', section: 'Background', label: 'Financial stress',
      text: 'How often is money a source of serious stress at home?', type: 'scale', or: 1.5 },
    { id: 'values', section: 'Background', label: 'Shared values',
      text: 'We agree on the big things: children, faith, where and how to live.', type: 'scale', or: 0.65 },

    // --- How you argue ----------------------------------------------------
    { id: 'criticism', section: 'How you argue', label: 'Criticism',
      text: 'Arguments turn into attacks on each other’s character ("you always…", "you never…").', type: 'scale', or: 1.5 },
    { id: 'contempt', section: 'How you argue', label: 'Contempt',
      text: 'One of us uses sarcasm, mockery, eye-rolling or insults during conflict.', type: 'scale', or: 2.2 },
    { id: 'defensive', section: 'How you argue', label: 'Defensiveness',
      text: 'When a problem is raised, the response is counter-blame rather than listening.', type: 'scale', or: 1.4 },
    { id: 'stonewall', section: 'How you argue', label: 'Stonewalling',
      text: 'One of us shuts down, goes silent or walks away in the middle of a discussion.', type: 'scale', or: 1.6 },
    { id: 'repair', section: 'How you argue', label: 'Repair after fights',
      text: 'After a fight we manage to calm down, apologise and make up.', type: 'scale', or: 0.55 },

    // --- Connection -------------------------------------------------------
    { id: 'fondness', section: 'Connection', label: 'Fondness and respect',
      text: 'We express appreciation, affection and respect for each other.', type: 'scale', or: 0.55 },
    { id: 'time', section: 'Connection', label: 'Quality time',
      text: 'We spend enjoyable time together and feel like a team.', type: 'scale', or: 0.65 },
    { id: 'known', section: 'Connection', label: 'Knowing each other',
      text: 'I know my partner’s current worries, hopes and daily life — and they know mine.', type: 'scale', or: 0.7 },
    { id: 'trust', section: 'Connection', label: 'Trust',
      text: 'Has there been infidelity or a serious breach of trust?', type: 'choice',
      options: [['No', 1.0], ['Yes, and we worked through it', 1.4], ['Yes, and it is unresolved', 2.4]] },
    { id: 'leaving', section: 'Connection', label: 'Thoughts of separating',
      text: 'One of us thinks or talks about separating.', type: 'scale', or: 2.6 },
  ];

  const logit = (p) => Math.log(p / (1 - p));
  const sigmoid = (x) => 1 / (1 + Math.exp(-x));

  // Log-odds contribution of one answer. `value` is the option index (choice)
  // or 0..4 (scale); the scale midpoint (2, "Sometimes") contributes nothing.
  function contribution(q, value) {
    if (q.type === 'choice') return Math.log(q.options[value][1]);
    return Math.log(q.or) * (value - 2) / 2;
  }

  // answers: { [questionId]: number }. Every question must be answered.
  function predict(answers) {
    let score = logit(BASELINE);
    const factors = [];
    for (const q of QUESTIONS) {
      const v = answers[q.id];
      const max = q.type === 'choice' ? q.options.length - 1 : 4;
      if (!Number.isInteger(v) || v < 0 || v > max) {
        throw new Error('Missing or invalid answer for "' + q.id + '"');
      }
      const c = contribution(q, v);
      score += c;
      factors.push({ id: q.id, label: q.label, contribution: c });
    }
    // The model is rough; never claim near-certainty either way.
    const probability = Math.min(0.95, Math.max(0.03, sigmoid(score)));
    const band = probability < 0.2 ? 'Low'
      : probability < 0.4 ? 'Moderate'
      : probability < 0.65 ? 'Elevated' : 'High';
    factors.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    return { probability, band, factors };
  }

  const api = { BASELINE, FREQ, QUESTIONS, predict };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Divorcy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
