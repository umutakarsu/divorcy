(function () {
  'use strict';
  const { QUESTIONS, HORIZON_YEARS, predict } = window.Divorcy;
  const $ = (id) => document.getElementById(id);
  const el = (tag, props, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  };

  const UNITS = { duration: 'years', age: 'years old' };
  const answers = {};
  let index = 0; // question currently shown

  $('question-count').textContent = QUESTIONS.length;

  function show(screen) {
    for (const id of ['intro', 'quiz', 'result']) $(id).hidden = id !== screen;
    window.scrollTo({ top: 0 });
  }

  function showQuestion(i) {
    index = i;
    const q = QUESTIONS[i];
    $('step-label').textContent = (i + 1) + ' of ' + QUESTIONS.length;
    $('bar').style.width = (i / QUESTIONS.length * 100) + '%';
    $('question').textContent = q.text;
    $('error').hidden = true;

    if (q.type === 'choice') {
      $('answer').replaceChildren(el('div', { className: 'options' }, ...q.options.map(([text], n) => {
        const b = el('button', { type: 'button', className: 'option', textContent: text });
        b.setAttribute('aria-pressed', String(answers[q.id] === n));
        b.addEventListener('click', () => {
          answers[q.id] = n;
          for (const other of $('answer').querySelectorAll('.option')) other.setAttribute('aria-pressed', String(other === b));
          setTimeout(next, 180); // let the selection show before moving on
        });
        return b;
      })));
    } else {
      const input = el('input', { type: 'number', id: 'number', min: q.min, max: q.max, inputMode: 'numeric',
        value: answers[q.id] ?? '' });
      input.setAttribute('aria-label', q.text);
      $('answer').replaceChildren(el('div', { className: 'number-row' }, input,
        el('span', { className: 'unit', textContent: UNITS[q.id] || '' }),
        el('button', { type: 'submit', className: 'primary', textContent: 'Continue' })));
    }

    // Restart the entrance animation and move focus for keyboard and screen-reader users.
    $('quiz').style.animation = 'none';
    void $('quiz').offsetWidth;
    $('quiz').style.animation = '';
    show('quiz');
    (q.type === 'number' ? $('number') : $('question')).focus({ preventScroll: true });
  }

  function next() {
    if (index + 1 < QUESTIONS.length) showQuestion(index + 1);
    else showResult();
  }

  // Number questions are submitted with Continue or Enter.
  $('quiz').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = QUESTIONS[index];
    if (q.type !== 'number') return;
    const raw = $('number').value.trim();
    const n = Number(raw);
    if (raw === '' || !(n >= q.min && n <= q.max)) {
      $('error').textContent = 'Enter a number between ' + q.min + ' and ' + q.max + '.';
      $('error').hidden = false;
      return;
    }
    answers[q.id] = n;
    next();
  });

  $('back').addEventListener('click', () => (index === 0 ? show('intro') : showQuestion(index - 1)));
  $('start').addEventListener('click', () => showQuestion(0));
  $('edit').addEventListener('click', () => showQuestion(0));
  $('restart').addEventListener('click', () => {
    for (const k of Object.keys(answers)) delete answers[k];
    show('intro');
  });

  function answerText(q, v) {
    if (q.type === 'choice') return q.options[v][0].toLowerCase();
    return q.id === 'duration' ? v + (v === 1 ? ' year' : ' years') : String(v);
  }

  function fillFactors(list, factors, emptyText) {
    // Ignore answers that sit almost exactly on the survey average.
    factors = factors.filter((f) => Math.abs(f.contribution) >= 0.05);
    if (!factors.length) return list.replaceChildren(el('li', { className: 'empty', textContent: emptyText }));
    const max = Math.abs(factors[0].contribution);
    list.replaceChildren(...factors.map((f) => {
      const q = QUESTIONS.find((x) => x.id === f.id);
      const fill = el('div', { className: 'fill' });
      fill.style.width = Math.max(6, Math.abs(f.contribution) / max * 100) + '%';
      return el('li', {}, f.label + ' ', el('span', { className: 'value', textContent: answerText(q, answers[f.id]) }),
        el('div', { className: 'track' }, fill));
    }));
  }

  const percent = (p) => (p < 0.01 ? '<1%' : Math.min(99, Math.round(p * 100)) + '%');

  function showResult() {
    const r = predict(answers);
    const group = r.married ? 'married' : 'unmarried';
    $('result-label').textContent = 'Chance you ' + (r.married ? 'divorce or separate' : 'break up')
      + ' within ' + HORIZON_YEARS + ' years';
    $('pct').textContent = percent(r.probability);
    $('band').textContent = r.band + ' risk';
    $('band').className = 'band ' + r.band.toLowerCase();
    const gap = r.probability - r.typical;
    $('summary').textContent = (Math.abs(gap) < 0.005 ? 'About the same as' : gap > 0 ? 'Higher than' : 'Lower than')
      + ' the average ' + group + ' couple in the study, who had a ' + percent(r.typical)
      + ' chance (the tick on the dial).';
    fillFactors($('risks'), r.factors.filter((f) => f.contribution > 0), 'Nothing stands out compared with the average ' + group + ' couple.');
    fillFactors($('protects'), r.factors.filter((f) => f.contribution < 0), 'Nothing stands out compared with the average ' + group + ' couple.');

    // Dial: the arc fills to the estimate; the tick marks the average couple.
    const fill = $('gauge-fill');
    fill.style.color = 'var(--' + (r.probability < 0.15 ? 'protect' : 'risk') + ')'; // stroke and glow follow it
    fill.style.strokeDasharray = '0 100';
    $('gauge-mark').style.transform = 'rotate(' + (r.typical * 180 - 90) + 'deg)';
    show('result');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fill.style.strokeDasharray = Math.max(0.5, r.probability * 100) + ' 100';
    }));
  }
})();
