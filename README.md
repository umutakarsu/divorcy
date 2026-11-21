# Divorcy

A small web app that estimates a couple's chance of divorcing or breaking up
within five years from 8 questions, using a model fitted on a real longitudinal
survey of couples, and shows which answers raise or lower the risk.

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

The model is fitted on Stanford's
[How Couples Meet and Stay Together](https://purl.stanford.edu/ns183dp7831)
survey (Rosenfeld, Thomas & Falcon; public domain, PDDL). It interviewed
partnered US adults in 2009 and re-contacted them up to five times until 2017
to ask whether the couple was still together. After dropping couples with no
follow-up or missing answers, 2,593 couples and 520 breakups remain.

`training/train.py` fits a Poisson regression on breakups per couple-year, so
couples who dropped out early still count for the years they were observed. It
writes the fitted numbers to `www/coefficients.js`; `www/model.js` applies them
and adds up five yearly rates into a five-year probability.

| Answer | Effect on yearly breakup rate (95% interval) |
| --- | --- |
| Each step down in relationship quality (excellent → very poor) | ×2.15 (1.96–2.36) |
| Living together | ×0.31 (0.25–0.39) |
| Each doubling of years together, unmarried / married | about ×0.77 / ×0.58 |
| Married before | ×1.52 (1.22–1.90) |
| Each 10 years of age | ×0.86 (0.79–0.94) |
| Each year of education | ×0.94 (0.90–0.98) |

In 5-fold cross-validation the model ranks couples well (AUC 0.88) and its
expected breakup counts track the observed ones, except that it overstates risk
for the safest fifth of couples (8.5 expected, 3 observed).

Results are compared with the average couple of the same marital status in the
survey: about 4% for married couples and 33% for unmarried ones over five years.

Limits worth knowing:

- **US couples, 2009–2017.** Other countries and later years may differ.
- **One partner's answers.** Only one person per couple was interviewed.
- **Association, not cause.** Moving in together will not cut your risk by 69%.
- **The monogamy question is not fitted.** The survey asked it only in 2014 and
  followed just 23 non-monogamous couples afterwards (4 broke up by 2017, against
  16 of 574 monogamous couples). That is too few to fit, so its ×2 weight is set
  by hand in `www/model.js`.
- **Same-sex couples.** The fit controls for same-sex couples, who broke up more
  often in this 2009 sample, when most could not legally marry. The app does not
  ask about it and scores everyone without that adjustment.

To retrain (downloads about 1 MB of survey files into `training/data/`):

```bash
pip install pandas statsmodels
```

```bash
python3 training/train.py
```

## Tests

```bash
npm test
```
