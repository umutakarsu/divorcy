# Divorcy

A small web app that estimates the likelihood of divorce from a 17-question
survey and shows which answers raise or lower the risk.

## Run it

No build step and no dependencies. Open `index.html` in a browser, or serve the
folder:

```bash
python3 -m http.server 8000
```

Everything runs in the browser. Answers are not stored or sent anywhere.

## How the estimate works

`model.js` is an additive log-odds model. It starts from a baseline risk of 38%
and each answer multiplies the odds by a factor:

- **Background** — age at marriage, education, parental divorce, previous
  marriages, time together before marriage, financial stress, shared values.
- **How you argue** — criticism, contempt, defensiveness, stonewalling
  (Gottman's "Four Horsemen") and whether repair after fights works.
- **Connection** — fondness and respect, quality time, knowing each other,
  breaches of trust, thoughts of separating.

The result is clamped to 3–95% and labelled Low, Moderate, Elevated or High.

**The weights are hand-set approximations of effects reported in marriage
research. They are not fitted to data, so the percentage is an educational
estimate and not a calibrated probability.** To change a weight or add a
question, edit the `QUESTIONS` list in `model.js`; the form is generated from it.

## Tests

```bash
node --test
```
