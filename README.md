# Divorcy

A small web app that estimates the likelihood of divorce from a 17-question
survey and shows which answers raise or lower the risk.

## Run it on the iPhone simulator (from VS Code)

The web app in `www/` is wrapped as a native iOS app with
[Capacitor](https://capacitorjs.com). You need a Mac with Xcode (which provides
the simulator) and Node 22 or newer.

First time only — open the folder in VS Code, open the terminal and run:

```bash
npm install
```

```bash
npm run ios:setup
```

This generates the Xcode project in `ios/`. After that, press **Cmd+Shift+B**
(or run `npm run ios`), pick a simulator from the list, and the app builds,
installs and launches. Re-run it after editing anything in `www/`.

## Run it in a browser

```bash
npm run web
```

Then open http://localhost:8000. Opening `www/index.html` directly also works.

Everything runs on the device. Answers are not stored or sent anywhere.

## How the estimate works

`www/model.js` is an additive log-odds model. It starts from a baseline risk of 38%
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
question, edit the `QUESTIONS` list in `www/model.js`; the form is generated from it.

## Tests

```bash
npm test
```
