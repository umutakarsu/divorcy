(function () {
  'use strict';
  const { QUESTIONS, FREQ, BASELINE, predict } = window.Divorcy;
  const $ = (id) => document.getElementById(id);

  const sections = [...new Set(QUESTIONS.map((q) => q.section))];
  let step = 0;

  // Render every question once, grouped into one page per section.
  for (const name of sections) {
    const page = document.createElement('div');
    page.className = 'page';
    for (const q of QUESTIONS.filter((x) => x.section === name)) {
      const fs = document.createElement('fieldset');
      fs.dataset.id = q.id;
      const legend = document.createElement('legend');
      legend.textContent = q.text;
      const opts = document.createElement('div');
      opts.className = 'options';
      const labels = q.type === 'scale' ? FREQ : q.options.map((o) => o[0]);
      labels.forEach((text, i) => {
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
      fs.append(legend, opts);
      page.append(fs);
    }
    $('sections').append(page);
  }
  const pages = [...document.querySelectorAll('.page')];

  function readAnswers() {
    const a = {};
    for (const q of QUESTIONS) {
      const checked = document.querySelector('input[name="' + q.id + '"]:checked');
      if (checked) a[q.id] = Number(checked.value);
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

  function fillFactors(list, factors, emptyText, answers) {
    list.replaceChildren();
    if (!factors.length) {
      const li = document.createElement('li');
      li.innerHTML = '<span class="empty"></span>';
      li.firstChild.textContent = emptyText;
      list.append(li);
      return;
    }
    const max = Math.abs(factors[0].contribution);
    for (const f of factors.slice(0, 5)) {
      const li = document.createElement('li');
      const name = document.createElement('span');
      // Show the chosen answer too, so "Criticism" under "protects" reads as "Criticism: Never".
      const q = QUESTIONS.find((x) => x.id === f.id);
      const v = answers[f.id];
      name.textContent = f.label + ': ' + (q.type === 'scale' ? FREQ[v] : q.options[v][0]).toLowerCase();
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

  function showResult() {
    const answers = readAnswers();
    const r = predict(answers);
    const pct = Math.round(r.probability * 100);
    $('pct').textContent = pct + '%';
    $('band').textContent = r.band + ' risk';
    $('band').className = 'band ' + r.band.toLowerCase();
    $('meter-fill').style.width = pct + '%';
    $('baseline-mark').style.left = BASELINE * 100 + '%';
    const base = Math.round(BASELINE * 100);
    $('summary').textContent = pct === base
      ? 'That is about the same as the typical couple in this model (' + base + '%, the marker on the bar).'
      : 'That is ' + (pct > base ? 'higher' : 'lower') + ' than the typical couple in this model (' + base + '%, the marker on the bar).';
    fillFactors($('risks'), r.factors.filter((f) => f.contribution > 0), 'Nothing in your answers stands out as a risk.', answers);
    fillFactors($('protects'), r.factors.filter((f) => f.contribution < 0), 'Nothing in your answers stands out as protective.', answers);
    $('quiz').hidden = true;
    $('result').hidden = false;
    window.scrollTo({ top: 0 });
  }

  $('quiz').addEventListener('change', (e) => {
    e.target.closest('fieldset').classList.remove('missing');
    updateBar();
  });
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
