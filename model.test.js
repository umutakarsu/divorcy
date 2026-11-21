// Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const { QUESTIONS, BASELINE, predict } = require('./www/model.js');

// Build an answer set by picking, per question, the option chosen by `pick`.
function answers(pick) {
  const a = {};
  for (const q of QUESTIONS) a[q.id] = pick(q);
  return a;
}
const refIndex = (q) => q.type === 'scale' ? 2 : q.options.findIndex((o) => o[1] === 1.0);
const extreme = (q, worst) => {
  if (q.type === 'scale') return (q.or > 1) === worst ? 4 : 0;
  const ors = q.options.map((o) => o[1]);
  return ors.indexOf(worst ? Math.max(...ors) : Math.min(...ors));
};

test('reference answers give the baseline', () => {
  const r = predict(answers(refIndex));
  assert.ok(Math.abs(r.probability - BASELINE) < 1e-9);
  assert.strictEqual(r.band, 'Moderate');
});

test('best and worst cases hit the clamps', () => {
  const best = predict(answers((q) => extreme(q, false)));
  const worst = predict(answers((q) => extreme(q, true)));
  assert.strictEqual(best.probability, 0.03);
  assert.strictEqual(best.band, 'Low');
  assert.strictEqual(worst.probability, 0.95);
  assert.strictEqual(worst.band, 'High');
});

test('each question moves risk in the expected direction', () => {
  for (const q of QUESTIONS) {
    const lo = predict({ ...answers(refIndex), [q.id]: extreme(q, false) }).probability;
    const hi = predict({ ...answers(refIndex), [q.id]: extreme(q, true) }).probability;
    assert.ok(hi > lo, q.id);
  }
});

test('factors are sorted by size of effect', () => {
  const r = predict({ ...answers(refIndex), contempt: 4, repair: 3 });
  assert.strictEqual(r.factors[0].id, 'contempt');
  assert.ok(r.factors[0].contribution > 0);
  assert.strictEqual(r.factors[1].id, 'repair');
  assert.ok(r.factors[1].contribution < 0);
});

test('missing answers are rejected', () => {
  const a = answers(refIndex);
  delete a.trust;
  assert.throws(() => predict(a), /trust/);
});
