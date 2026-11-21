"""Fit Divorcy's breakup-rate model on the HCMST survey and write www/coefficients.js.

Data: Rosenfeld, Thomas & Falcon, "How Couples Meet and Stay Together" (HCMST),
waves 1-6, Stanford University Libraries, https://purl.stanford.edu/ns183dp7831
(Open Data Commons PDDL). 3,009 partnered US adults were surveyed in 2009 and
re-contacted up to five times until 2017 to ask whether the couple was still together.

Model: Poisson regression on breakups per couple-year (a constant-hazard survival
model), so couples who dropped out early still count for the years they were seen.

Usage:  pip install pandas statsmodels
        python3 training/train.py
The raw files are downloaded to training/data/ (git-ignored) on first run.
"""
import json
import pathlib
import urllib.request
import zipfile

import numpy as np
import pandas as pd
import statsmodels.api as sm

HERE = pathlib.Path(__file__).resolve().parent
DATA = HERE / 'data'
OUT = HERE.parent / 'www' / 'coefficients.js'
BASE_URL = 'https://stacks.stanford.edu/file/druid:ns183dp7831/'
FILES = {  # download name -> .dta file it yields
    'HCMST_ver_3.04_Stata.zip': 'HCMST_ver_3.04.dta',
    'wave_4_supplement_v1_2.zip': 'wave_4_supplement_v1_2.dta',
    'HCMST_wave_5_supplement_ver_1.zip': 'HCMST_wave_5_supplement_ver_1.dta',
    'HCMST_wave_6_public_v1.dta': 'HCMST_wave_6_public_v1.dta',
}
FEATURES = ['married', 'coresident', 'bad_quality', 'log_duration', 'age10',
            'years_education', 'prior_marriage', 'married_x_log_duration', 'same_sex']


def download():
    DATA.mkdir(exist_ok=True)
    for name, dta in FILES.items():
        if (DATA / dta).exists():
            continue
        print('downloading', name)
        urllib.request.urlretrieve(BASE_URL + name, DATA / name)
        if name.endswith('.zip'):
            zipfile.ZipFile(DATA / name).extractall(DATA)


def years(yrmo):
    """YYYYMM -> fractional calendar year."""
    yrmo = pd.to_numeric(yrmo, errors='coerce')
    return yrmo // 100 + (yrmo % 100 - 0.5) / 12


def build():
    """One row per couple: 2009 answers, years observed, and whether they broke up."""
    read = lambda f: pd.read_stata(DATA / f, convert_categoricals=False)
    d = (read('HCMST_ver_3.04.dta')
         .merge(read('wave_4_supplement_v1_2.dta'), on='caseid_new')
         .merge(read('HCMST_wave_5_supplement_ver_1.dta'), on='caseid_new')
         .merge(read('HCMST_wave_6_public_v1.dta')[['caseid_new', 'w6_broke_up', 'w6_HCMST_yrmo']],
                on='caseid_new', how='left'))
    d = d[(d.qflag == 1) & (d.partner_deceased != 1)].copy()  # partnered, partner alive

    # Walk the follow-up waves in order. *_broke_up: 0 still together, 1 broke up, 2 partner died.
    waves = [('w2_broke_up', 'w2_HCMST_interview_fin_yrmo'), ('w3_broke_up', 'w3_HCMST_interview_fin_yrmo'),
             ('w4_broke_up', 'w4_HCMST_interview_fin_yrmo'), ('w5_broke_up', 'w5_HCMST_interview_fin_yrmo'),
             ('w6_broke_up', 'w6_HCMST_yrmo')]
    start = years(d.HCMST_main_interview_yrmo).values
    n = len(d)
    last_seen, event, exposure, done = np.zeros(n), np.zeros(n), np.full(n, np.nan), np.zeros(n, bool)
    for status_col, date_col in waves:
        status, t = d[status_col].values, years(d[date_col]).values - start
        seen = ~done & ~np.isnan(status) & ~np.isnan(t)
        together = seen & (status == 0)
        last_seen[together] = t[together]
        broke = seen & (status == 1)
        event[broke] = 1
        exposure[broke] = (last_seen[broke] + t[broke]) / 2  # date unknown: midpoint since last contact
        done |= broke | (seen & (status == 2))               # a partner's death ends follow-up, not a breakup
    exposure[np.isnan(exposure)] = last_seen[np.isnan(exposure)]

    x = pd.DataFrame(index=d.index)
    x['event'], x['years'] = event, exposure
    x['married'] = d.married
    x['coresident'] = d.coresident
    x['bad_quality'] = 5 - d.relationship_quality            # 0 excellent .. 4 very poor
    x['log_duration'] = np.log1p(d.how_long_relationship)    # years as a couple
    x['age10'] = d.ppage / 10
    x['years_education'] = d.respondent_yrsed
    # q17a (married people) counts the current marriage; q17b (unmarried) is coded 1 = never married.
    times_married = d.q17a.where(d.q17a > 0).fillna((d.q17b - 1).where(d.q17b > 0))
    x['prior_marriage'] = ((times_married - d.married) >= 1).astype(float).where(times_married.notna())
    x['married_x_log_duration'] = x.married * x.log_duration
    x['same_sex'] = d.same_sex_couple
    return x[x.years > 0].dropna()   # needs at least one follow-up and complete answers


def fit(df):
    return sm.GLM(df.event, sm.add_constant(df[FEATURES]), family=sm.families.Poisson(),
                  offset=np.log(df.years)).fit()


def cross_validate(df, folds=5):
    """Out-of-sample check: expected vs observed breakups by risk group, and ranking accuracy (AUC)."""
    fold = np.random.default_rng(0).integers(0, folds, len(df))
    expected = np.zeros(len(df))
    for k in range(folds):
        test = fold == k
        expected[test] = fit(df[~test]).predict(sm.add_constant(df[FEATURES])[test], offset=np.log(df.years[test]))
    rate = expected / df.years
    groups = pd.qcut(rate, 5, labels=False)
    table = pd.DataFrame({'observed': df.event, 'expected': expected}).groupby(groups).sum().round(1)
    # AUC by pair counting, so scikit-learn is not needed.
    order = rate.rank().values
    pos = df.event.values == 1
    auc = (order[pos].sum() - pos.sum() * (pos.sum() + 1) / 2) / (pos.sum() * (~pos).sum())
    return table, float(auc)


def main():
    download()
    df = build()
    result = fit(df)
    ci = result.conf_int()
    print(f'{len(df)} couples, {int(df.event.sum())} breakups, {df.years.sum():.0f} couple-years')
    print(pd.DataFrame({'rate_ratio': np.exp(result.params), 'low': np.exp(ci[0]), 'high': np.exp(ci[1]),
                        'p': result.pvalues}).round(3))
    table, auc = cross_validate(df)
    print('\n5-fold cross-validation, couples grouped from lowest to highest predicted risk:')
    print(table)
    print(f'AUC {auc:.3f}')

    # same_sex is a control only: the app does not ask it and scores everyone at 0.
    # (In 2009 most US same-sex couples could not marry, so the effect reflects that period.)
    asked = [f for f in FEATURES if f != 'same_sex']
    means = {('married' if m else 'unmarried'): {f: round(float(g[f].mean()), 4) for f in asked}
             for m, g in df.groupby('married')}
    out = {
        'source': 'HCMST waves 1-6 (2009-2017), https://purl.stanford.edu/ns183dp7831',
        'couples': len(df), 'breakups': int(df.event.sum()), 'cvAuc': round(auc, 3),
        'intercept': round(float(result.params['const']), 4),
        'coefficients': {f: round(float(result.params[f]), 4) for f in asked},
        'means': means,
    }
    OUT.write_text(
        '// GENERATED by training/train.py from the HCMST survey. Do not edit by hand.\n'
        '// Log rate ratios for breakups per couple-year, plus average answers by marital status.\n'
        '(function (root) {\n  const data = ' + json.dumps(out, indent=2).replace('\n', '\n  ') + ';\n'
        "  if (typeof module !== 'undefined' && module.exports) module.exports = data;\n"
        '  else root.DivorcyCoefficients = data;\n'
        "})(typeof globalThis !== 'undefined' ? globalThis : this);\n")
    print('\nwrote', OUT)


if __name__ == '__main__':
    main()
