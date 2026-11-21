// Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const { QUESTIONS, DATA, NON_MONOGAMY_RATE_RATIO, predict } = require('./www/model.js');

const opt = (id, text) => QUESTIONS.find((q) => q.id === id).options.findIndex((o) => o[0].startsWith(text));

// A long-married, happy couple; individual tests override single answers.
const base = {
  married: opt('married', 'Yes'), coresident: opt('coresident', 'Yes'), duration: 15,
  quality: opt('quality', 'Excellent'), monogamy: opt('monogamy', 'Yes'),
  age: 45, education: opt('education', 'Bachelor'), prior: opt('prior', 'No'),
};
const p = (overrides) => predict({ ...base, ...overrides }).probability;

test('matches a hand calculation from the fitted coefficients', () => {
  const B = DATA.coefficients;
  let cumulative = 0;
  for (let k = 0; k < 5; k++) {
    const logDur = Math.log1p(15 + k);
    cumulative += Math.exp(DATA.intercept + B.married + B.coresident + B.log_duration * logDur
      + B.married_x_log_duration * logDur + B.age10 * (45 + k) / 10 + B.years_education * 16);
  }
  assert.ok(Math.abs(p({}) - (1 - Math.exp(-cumulative))) < 1e-12);
});

test('a stable couple is low risk and a struggling one is high risk', () => {
  const good = predict(base);
  assert.strictEqual(good.band, 'Low');
  assert.ok(good.probability < good.typical);
  const bad = predict({ ...base, married: opt('married', 'No'), coresident: opt('coresident', 'No'),
    duration: 1, quality: opt('quality', 'Poor'), age: 22 });
  assert.strictEqual(bad.band, 'High');
  assert.ok(bad.probability > bad.typical);
});

test('each answer moves risk in the direction the data shows', () => {
  assert.ok(p({ quality: opt('quality', 'Fair') }) > p({}));
  assert.ok(p({ coresident: opt('coresident', 'No') }) > p({}));
  assert.ok(p({ duration: 2 }) > p({}));
  assert.ok(p({ age: 25 }) > p({}));
  assert.ok(p({ education: opt('education', 'High school') }) > p({}));
  assert.ok(p({ prior: opt('prior', 'Yes') }) > p({}));
  assert.ok(p({ monogamy: opt('monogamy', 'No') }) > p({}));
});

test('typical couple is the survey average for the same marital status', () => {
  const married = predict(base).typical;
  const unmarried = predict({ ...base, married: opt('married', 'No') }).typical;
  assert.ok(married > 0.02 && married < 0.15, String(married));
  assert.ok(unmarried > 0.3 && unmarried < 0.7, String(unmarried));
});

test('factors explain the gap to the typical couple, biggest first', () => {
  const r = predict({ ...base, quality: opt('quality', 'Very poor'), monogamy: opt('monogamy', 'No') });
  assert.strictEqual(r.factors[0].id, 'quality');
  assert.ok(r.factors[0].contribution > 0);
  const mono = r.factors.find((f) => f.id === 'monogamy');
  assert.ok(Math.abs(mono.contribution - Math.log(NON_MONOGAMY_RATE_RATIO)) < 1e-12);
  assert.ok(r.factors.every((f, i) => i === 0 || Math.abs(f.contribution) <= Math.abs(r.factors[i - 1].contribution)));
});

test('missing or out-of-range answers are rejected', () => {
  const missing = { ...base };
  delete missing.quality;
  assert.throws(() => predict(missing), /quality/);
  assert.throws(() => predict({ ...base, age: 12 }), /age/);
  assert.throws(() => predict({ ...base, duration: -1 }), /duration/);
});
