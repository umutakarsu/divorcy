(function () {
  'use strict';
  const { QUESTIONS, HORIZON_YEARS, DATA, predict } = window.Divorcy;
  const $ = (id) => document.getElementById(id);

  const sections = [...new Set(QUESTIONS.map((q) => q.section))];
  let step = 0;

  $('question-count').textContent = QUESTIONS.length;
  $('study-size').textContent = DATA.couples.toLocaleString('en');

  // Render every question once, grouped into one page per section.
  for (const name of sections) {
    const page = document.createElement('div');
    page.className = 'page';
    for (const q of QUESTIONS.filter((x) => x.section === name)) {
      const fs = document.createElement('fieldset');
      fs.dataset.id = q.id;
      const legend = document.createElement('legend');
      legend.textContent = q.text;
      fs.append(legend);
      if (q.type === 'number') {
        const input = document.createElement('input');
        input.type = 'number';
        input.name = q.id;
        input.min = q.min;
        input.max = q.max;
        input.inputMode = 'numeric';
        input.setAttribute('aria-label', q.text);
        fs.append(input);
      } else {
        const opts = document.createElement('div');
        opts.className = 'options';
        q.options.forEach(([text], i) => {
          const label = document.createElement('label');
          const input = document.createElement('input');
          input.type = 'radio';
          input.name = q.id;
          input.value = i;
          const span = document.createElement('span');
          span.textContent = text;
          label.append(input, span);
          opts.append(label);
        });
        fs.append(opts);
      }
      page.append(fs);
    }
    $('sections').append(page);
  }
  const pages = [...document.querySelectorAll('.page')];

  // Only valid answers are returned; a blank or out-of-range number counts as unanswered.
  function readAnswers() {
    const a = {};
    for (const q of QUESTIONS) {
      if (q.type === 'number') {
        const raw = document.querySelector('input[name="' + q.id + '"]').value.trim();
        const n = Number(raw);
        if (raw !== '' && n >= q.min && n <= q.max) a[q.id] = n;
      } else {
        const checked = document.querySelector('input[name="' + q.id + '"]:checked');
        if (checked) a[q.id] = Number(checked.value);
      }
    }
    return a;
  }

  function showStep() {
    pages.forEach((p, i) => { p.hidden = i !== step; });
    $('step-label').textContent = 'Part ' + (step + 1) + ' of ' + sections.length + ' — ' + sections[step];
    $('back').disabled = step === 0;
    $('next').textContent = step === sections.length - 1 ? 'See my estimate' : 'Next';
    $('error').hidden = true;
    updateBar();
  }

  function updateBar() {
    $('bar').style.width = (Object.keys(readAnswers()).length / QUESTIONS.length * 100) + '%';
  }

  // Marks unanswered questions on the current page; returns true if complete.
  function validatePage() {
    const answers = readAnswers();
    let ok = true;
    for (const fs of pages[step].querySelectorAll('fieldset')) {
      const missing = !(fs.dataset.id in answers);
      fs.classList.toggle('missing', missing);
      if (missing && ok) fs.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (missing) ok = false;
    }
    $('error').hidden = ok;
    return ok;
  }

  function answerText(q, v) {
    if (q.type === 'choice') return q.options[v][0].toLowerCase();
    return q.id === 'duration' ? v + (v === 1 ? ' year' : ' years') : String(v);
  }

  function fillFactors(list, factors, emptyText, answers) {
    list.replaceChildren();
    // Ignore answers that sit almost exactly on the survey average.
    factors = factors.filter((f) => Math.abs(f.contribution) >= 0.05);
    if (!factors.length) {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.className = 'empty';
      span.textContent = emptyText;
      li.append(span);
      list.append(li);
      return;
    }
    const max = Math.abs(factors[0].contribution);
    for (const f of factors) {
      const li = document.createElement('li');
      const name = document.createElement('span');
      const q = QUESTIONS.find((x) => x.id === f.id);
      name.textContent = f.label + ': ' + answerText(q, answers[f.id]);
      const track = document.createElement('div');
      track.className = 'track';
      const fill = document.createElement('div');
      fill.className = 'fill';
      fill.style.width = Math.max(6, Math.abs(f.contribution) / max * 100) + '%';
      track.append(fill);
      li.append(name, track);
      list.append(li);
    }
  }

  const percent = (p) => (p < 0.01 ? 'under 1%' : Math.min(99, Math.round(p * 100)) + '%');

  function showResult() {
    const answers = readAnswers();
    const r = predict(answers);
    const outcome = r.married ? 'divorce or separate' : 'break up';
    const group = r.married ? 'married' : 'unmarried';
    $('result-label').textContent = 'Chance you ' + outcome + ' within ' + HORIZON_YEARS + ' years';
    $('pct').textContent = percent(r.probability);
    $('band').textContent = r.band + ' risk';
    $('band').className = 'band ' + r.band.toLowerCase();
    $('meter-fill').style.width = Math.max(1, r.probability * 100) + '%';
    $('baseline-mark').style.left = r.typical * 100 + '%';
    const gap = r.probability - r.typical;
    $('summary').textContent = (Math.abs(gap) < 0.005 ? 'About the same as' : gap > 0 ? 'Higher than' : 'Lower than')
      + ' the average ' + group + ' couple in the study (' + percent(r.typical) + ', the marker on the bar).';
    fillFactors($('risks'), r.factors.filter((f) => f.contribution > 0),
      'Nothing in your answers raises your risk above the average ' + group + ' couple.', answers);
    fillFactors($('protects'), r.factors.filter((f) => f.contribution < 0),
      'Nothing in your answers lowers your risk below the average ' + group + ' couple.', answers);
    $('quiz').hidden = true;
    $('result').hidden = false;
    window.scrollTo({ top: 0 });
  }

  const onAnswer = (e) => {
    e.target.closest('fieldset').classList.remove('missing');
    updateBar();
  };
  $('quiz').addEventListener('change', onAnswer);
  $('quiz').addEventListener('input', onAnswer);
  $('quiz').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validatePage()) return;
    if (step === sections.length - 1) return showResult();
    step++;
    showStep();
    window.scrollTo({ top: 0 });
  });
  $('back').addEventListener('click', () => { step--; showStep(); });
  $('edit').addEventListener('click', () => {
    $('result').hidden = true;
    $('quiz').hidden = false;
    step = 0;
    showStep();
  });
  $('restart').addEventListener('click', () => {
    $('quiz').reset();
    $('edit').click();
  });

  showStep();
})();
