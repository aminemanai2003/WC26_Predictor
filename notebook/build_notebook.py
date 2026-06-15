"""Build wc2026_pipeline.ipynb from cell definitions in this file.

Run:  python build_notebook.py
Produces: wc2026_pipeline.ipynb

This is the source of truth for the notebook. Editing the .ipynb directly is fine
for experimentation, but commit changes back here so the build is reproducible.
"""
import json
from pathlib import Path

CELLS = []

def md(src):
    CELLS.append({
        "id": f"cell-{len(CELLS):03d}",
        "cell_type": "markdown",
        "metadata": {},
        "source": src.strip("\n").splitlines(keepends=True),
    })

def code(src):
    CELLS.append({
        "id": f"cell-{len(CELLS):03d}",
        "cell_type": "code",
        "metadata": {},
        "execution_count": None,
        "outputs": [],
        "source": src.strip("\n").splitlines(keepends=True),
    })

# =============================================================================
md(r"""
# FIFA World Cup 2026 — End-to-End ML Pipeline (CRISP-DM)

This single notebook trains the prediction models and exports JSON artifacts
consumed by the Next.js site. Run **Kernel → Restart & Run All** to reproduce
everything from raw Kaggle data to deployable JSON.

**Pipeline stages (CRISP-DM):**
1. Business Understanding — objectives, format, success criteria
2. Data Understanding — Kaggle download, schema, EDA
3. Data Preparation — Elo, features, time-based split
4. Modeling — walk-forward classifier selection + Dixon-Coles goals + calibration
5. Evaluation — log-loss, Brier, RPS, calibration plot, WC 2022 backtest
6. Deployment — JSON artifact export to `web/public/data/`

Hardware target: laptop with RTX 2050 / 16 GB RAM. XGBoost runs on CPU in seconds
on this dataset (~50k matches); GPU is optional.
""")

# =============================================================================
md(r"""
## Phase 1 — Business Understanding

**Goal.** Calibrated probabilities for every WC 2026 match plus tournament-level
probabilities (group qualification, knockout progression, championship) via Monte
Carlo simulation.

**Tournament format (2026 — first 48-team edition).**
- 48 teams, 12 groups of 4 (labels A–L)
- Top 2 of each group + 8 best third-placed teams → Round of 32
- 104 matches total: 72 group + 16 R32 + 8 R16 + 4 QF + 2 SF + 3rd-place + final
- Hosts: USA, Mexico, Canada. Host advantage modeled only for those three;
  every other fixture is treated as neutral venue.

**Success criteria.**
- Beat an **Elo-only logistic** baseline on log-loss, Brier score, and
  **RPS** (Ranked Probability Score — the standard metric for ordered
  football outcomes) on a held-out time-based test set (2024 onward).
- Reliability curve close to the diagonal (well-calibrated probabilities).
- WC 2022 backtest produces sensible champion odds.

**Risk / honesty.** Football outcomes are high-variance. A "good" classifier on
this task hits ~0.96–1.00 log-loss; the value is calibration, not certainty.
""")

# =============================================================================
md(r"""
## Phase 2 — Data Understanding

Two Kaggle datasets:

| Source | What | Notes |
|---|---|---|
| `martj42/international-football-results-from-1872-to-2017` | All international matches | Updated continuously despite the name; ~48k rows |
| `cashncarry/fifaworldranking` | FIFA ranking points over time | Joinable by team + date |

The WC 2026 team list and group draw live in `data/raw/wc2026_teams.json`
(hand-curated for the project — see file header).

### 2.1 Setup
""")

code(r"""
import os, sys, json, warnings, math, hashlib
from pathlib import Path
from datetime import date, datetime
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

warnings.filterwarnings("ignore")
pd.options.display.max_columns = 50
sns.set_theme(style="whitegrid", context="notebook")
RNG = np.random.default_rng(42)

ROOT = Path.cwd().parent if Path.cwd().name == "notebook" else Path.cwd()
RAW = ROOT / "data" / "raw"
PROC = ROOT / "data" / "processed"
ART = ROOT / "artifacts"
WEB_DATA = ROOT / "web" / "public" / "data"
for d in (RAW, PROC, ART, WEB_DATA):
    d.mkdir(parents=True, exist_ok=True)
print("Project root:", ROOT)
""")

code(r"""
# Verify Kaggle credentials. Either form works:
#   ~/.kaggle/kaggle.json      (legacy username+key JSON)
#   ~/.kaggle/access_token     (newer single-token format, KGAT_...)
KAGGLE_DIR = Path.home() / ".kaggle"
legacy = KAGGLE_DIR / "kaggle.json"
modern = KAGGLE_DIR / "access_token"
if legacy.exists() or modern.exists():
    print(f"Kaggle token OK ({'access_token' if modern.exists() else 'kaggle.json'})")
else:
    print(f"!! No Kaggle token in {KAGGLE_DIR}.")
    print("   Visit https://www.kaggle.com/settings/account, create a token,")
    print("   save it at one of the paths above, then re-run this cell.")
""")

code(r"""
import subprocess
from urllib.request import urlretrieve

def kaggle_download(slug: str, target: Path):
    target.mkdir(parents=True, exist_ok=True)
    print(f"  refreshing {slug} ...")
    subprocess.run(
        ["kaggle", "datasets", "download", "-d", slug, "-p", str(target), "--unzip", "--force"],
        check=True,
    )

results_dir = RAW / "results"
results_dir.mkdir(parents=True, exist_ok=True)
urlretrieve(
    "https://raw.githubusercontent.com/martj42/international_results/master/results.csv",
    results_dir / "results.csv",
)
print("  refreshed martj42/international_results")
urlretrieve(
    "https://raw.githubusercontent.com/openfootball/world-cup.json/master/2026/worldcup.json",
    RAW / "wc2026_live.json",
)
print("  refreshed openfootball/world-cup.json")
kaggle_download("cashncarry/fifaworldranking", RAW / "fifa_ranking")
print("Done.")
""")

code(r"""
# Locate CSVs (filenames sometimes change between dataset versions)
def find_csv(folder: Path, hint: str):
    for p in folder.rglob("*.csv"):
        if hint in p.name.lower():
            return p
    return None

results_csv = find_csv(RAW / "results", "results")
shootouts_csv = find_csv(RAW / "results", "shootout")
ranking_candidates = sorted((RAW / "fifa_ranking").rglob("*.csv"))
ranking_csv = ranking_candidates[-1] if ranking_candidates else None

print("results:  ", results_csv)
print("shootouts:", shootouts_csv)
print("ranking:  ", ranking_csv)

matches = pd.read_csv(results_csv, parse_dates=["date"])
wc_live = json.loads((RAW / "wc2026_live.json").read_text(encoding="utf-8"))
wc_live_matches = wc_live["matches"]
wc_completed_rows = []
for fixture in wc_live_matches:
    if "score" not in fixture or "ft" not in fixture["score"]:
        continue
    home_score, away_score = fixture["score"]["ft"]
    wc_completed_rows.append({
        "date": fixture["date"],
        "home_team": fixture["team1"],
        "away_team": fixture["team2"],
        "home_score": home_score,
        "away_score": away_score,
        "tournament": "FIFA World Cup",
        "city": fixture.get("ground", ""),
        "country": "",
        "neutral": fixture["team1"] not in {"Mexico", "Canada", "United States"},
    })
if wc_completed_rows:
    wc_completed = pd.DataFrame(wc_completed_rows)
    wc_completed["date"] = pd.to_datetime(wc_completed["date"])
    matches = pd.concat([matches, wc_completed], ignore_index=True)
    matches = matches.sort_values(["date", "home_team", "away_team", "home_score"], na_position="first")
    matches = matches.drop_duplicates(["date", "home_team", "away_team"], keep="last")
shootouts = pd.read_csv(shootouts_csv, parse_dates=["date"]) if shootouts_csv else pd.DataFrame()
ranking = pd.read_csv(ranking_csv)
date_col = next((c for c in ranking.columns if "date" in c.lower()), None)
ranking[date_col] = pd.to_datetime(ranking[date_col])
ranking = ranking.rename(columns={date_col: "date"})
print(f"matches: {len(matches):,}   shootouts: {len(shootouts):,}   ranking rows: {len(ranking):,}")
matches.head()
""")

md(r"""
### 2.2 EDA
""")

code(r"""
modern = matches[matches["date"] >= "1993-01-01"].copy()
# Drop unplayed future fixtures (the Kaggle file now includes them with NaN scores)
before = len(modern)
modern = modern.dropna(subset=["home_score", "away_score"])
modern["home_score"] = modern["home_score"].astype(int)
modern["away_score"] = modern["away_score"].astype(int)
print(f"Dropped {before - len(modern)} unplayed/NaN-score matches; {len(modern)} remain")
modern["total_goals"] = modern["home_score"] + modern["away_score"]
modern["result"] = np.where(modern["home_score"] > modern["away_score"], "H",
                    np.where(modern["home_score"] < modern["away_score"], "A", "D"))

print("Matches since 1993:", len(modern))
print("\nResult distribution (all venues):")
print(modern["result"].value_counts(normalize=True).round(3))
print("\nResult distribution (NEUTRAL venue only):")
print(modern[modern["neutral"]]["result"].value_counts(normalize=True).round(3))

fig, axes = plt.subplots(1, 2, figsize=(13, 4))
sns.histplot(modern["home_score"].clip(0, 8), discrete=True, ax=axes[0], color="#0a84ff")
axes[0].set_title("Home goals distribution (Poisson check)")
sns.histplot(modern["total_goals"].clip(0, 10), discrete=True, ax=axes[1], color="#34c759")
axes[1].set_title("Total goals per match")
plt.tight_layout(); plt.show()
""")

code(r"""
# Tournament tier — informs Elo K-factor and feature
def tier(tournament: str) -> int:
    t = (tournament or "").lower()
    if "fifa world cup" in t and "qualifi" not in t: return 4
    if "uefa euro" in t or "copa am" in t or "africa cup" in t or "asian cup" in t or "concacaf" in t or "nations league" in t: return 3
    if "qualif" in t: return 2
    if "friendly" in t: return 1
    return 2

modern["tier"] = modern["tournament"].apply(tier)
print(modern.groupby("tier")["result"].value_counts(normalize=True).round(3))
""")

# =============================================================================
md(r"""
## Phase 3 — Data Preparation

### 3.1 Team name normalization (data-driven)

Strategy: explicit override map for WC 2026 nations + historical aliases
(West Germany → DEU, Korea Republic → KOR, USSR → RUS, etc.). For everything
else we **auto-derive** a stable 3-letter code from the country name so no
match is silently dropped from training. Previous version dropped ~70% of
matches because the override map only listed ~95 nations.
""")

code(r"""
import unicodedata, re

# Historical / alternate names → modern canonical name
ALIASES = {
    "West Germany": "Germany", "East Germany": "Germany",
    "Korea Republic": "South Korea", "Korea DPR": "North Korea",
    "USSR": "Russia", "Soviet Union": "Russia",
    "Czechoslovakia": "Czech Republic", "Yugoslavia": "Serbia",
    "Serbia and Montenegro": "Serbia",
    "Bosnia & Herzegovina": "Bosnia and Herzegovina",
    "Zaire": "DR Congo", "DR Congo": "DR Congo", "Congo DR": "DR Congo",
    "Burma": "Myanmar", "Ceylon": "Sri Lanka",
    "Cote d'Ivoire": "Ivory Coast",
    "Côte d'Ivoire": "Ivory Coast",
    "Cabo Verde": "Cape Verde", "Cape Verde Islands": "Cape Verde",
    "Czechia": "Czech Republic",
    "Türkiye": "Turkey",
    "Curacao": "Curaçao",
    "Congo DR": "DR Congo",
    "FYR Macedonia": "North Macedonia",
    "China PR": "China",
    "Iran": "Iran",
    "USA": "United States",
}

# Explicit ISO-3 for the 48 WC 2026 nations + common opponents (keeps codes stable)
EXPLICIT_CODE = {
    "United States": "USA", "Mexico": "MEX", "Canada": "CAN",
    "Argentina": "ARG", "Brazil": "BRA", "Uruguay": "URU", "Colombia": "COL",
    "Ecuador": "ECU", "Paraguay": "PRY", "Chile": "CHL", "Peru": "PER",
    "Venezuela": "VEN", "Bolivia": "BOL",
    "Spain": "ESP", "France": "FRA", "England": "ENG", "Germany": "GER",
    "Netherlands": "NED", "Portugal": "POR", "Belgium": "BEL", "Italy": "ITA",
    "Croatia": "CRO", "Switzerland": "SUI", "Denmark": "DNK", "Austria": "AUT",
    "Poland": "POL", "Turkey": "TUR", "Norway": "NOR", "Scotland": "SCO",
    "Sweden": "SWE", "Czech Republic": "CZE", "Wales": "WAL",
    "Republic of Ireland": "IRL", "Northern Ireland": "NIR",
    "Serbia": "SRB", "Ukraine": "UKR", "Greece": "GRC", "Romania": "ROU",
    "Hungary": "HUN", "Russia": "RUS", "Slovakia": "SVK", "Slovenia": "SVN",
    "Iceland": "ISL", "Finland": "FIN", "Bosnia and Herzegovina": "BIH",
    "North Macedonia": "MKD", "Albania": "ALB", "Montenegro": "MNE",
    "Japan": "JPN", "South Korea": "KOR", "Iran": "IRN",
    "Australia": "AUS", "Saudi Arabia": "SAU", "Jordan": "JOR",
    "Uzbekistan": "UZB", "Qatar": "QAT",
    "China": "CHN", "Iraq": "IRQ",
    "Morocco": "MAR", "Senegal": "SEN", "Egypt": "EGY", "Tunisia": "TUN",
    "Algeria": "ALG", "Ivory Coast": "CIV", "Ghana": "GHA", "Cape Verde": "CPV",
    "South Africa": "RSA", "Nigeria": "NGA", "Cameroon": "CMR", "Mali": "MLI",
    "DR Congo": "COD",
    "Curaçao": "CUW", "Haiti": "HAI",
    "New Zealand": "NZL",
    "Panama": "PAN", "Costa Rica": "CRI", "Jamaica": "JAM",
    "Honduras": "HND", "El Salvador": "SLV", "Trinidad and Tobago": "TTO",
}

_auto_cache = {}
def auto_code(name: str) -> str:
    if name in _auto_cache: return _auto_cache[name]
    ascii_name = unicodedata.normalize("NFD", str(name)).encode("ascii", "ignore").decode()
    words = re.findall(r"[A-Za-z]+", ascii_name)
    if not words:
        return None
    if len(words) == 1:
        code = words[0][:3].upper()
    else:
        # First letter of first 2-3 words, fallback to 3 letters of first word
        code = "".join(w[0] for w in words[:3]).upper()
        if len(code) < 3:
            code = (code + words[0][1:])[:3].upper()
    # De-dup: if collision with an existing code for a DIFFERENT name, append last letter
    used = {v for v in EXPLICIT_CODE.values()} | set(_auto_cache.values())
    base = code
    salt = 0
    while code in used:
        salt += 1
        code = (base[:2] + str(salt))[:3]
    _auto_cache[name] = code
    return code

def to_code(name):
    if pd.isna(name): return None
    n = ALIASES.get(str(name).strip(), str(name).strip())
    if n in EXPLICIT_CODE: return EXPLICIT_CODE[n]
    return auto_code(n)

modern["home_code"] = modern["home_team"].map(to_code)
modern["away_code"] = modern["away_team"].map(to_code)
mapped = modern.dropna(subset=["home_code", "away_code"]).copy()
print(f"Matches with both teams mapped: {len(mapped):,} / {len(modern):,}  "
      f"({100*len(mapped)/len(modern):.1f}%)")
print(f"Distinct teams: {len(set(mapped['home_code']) | set(mapped['away_code']))}")
""")

md(r"""
### 3.2 Elo rating (chronological — no leakage)

Custom Elo, K-factor scaled by tournament tier and goal-difference multiplier
(Dixon–Coles style). All training features use the Elo **as of the day before
the match** — never the post-match update.
""")

code(r"""
INIT_ELO = 1500.0
HOME_ADV = 60.0  # ELO points

def k_factor(tier_):
    return {4: 60, 3: 50, 2: 40, 1: 30}.get(tier_, 30)

def gd_mult(gd):
    gd = abs(gd)
    if gd <= 1: return 1.0
    if gd == 2: return 1.5
    return (11 + gd) / 8.0

elo = {}
mapped = mapped.sort_values("date").reset_index(drop=True)
home_elos = np.empty(len(mapped))
away_elos = np.empty(len(mapped))

for i, row in enumerate(mapped.itertuples(index=False)):
    h, a = row.home_code, row.away_code
    eh = elo.get(h, INIT_ELO)
    ea = elo.get(a, INIT_ELO)
    home_elos[i] = eh
    away_elos[i] = ea
    adv = 0.0 if row.neutral else HOME_ADV
    exp_h = 1.0 / (1.0 + 10 ** (-(eh + adv - ea) / 400))
    if row.home_score > row.away_score: actual_h = 1.0
    elif row.home_score < row.away_score: actual_h = 0.0
    else: actual_h = 0.5
    k = k_factor(row.tier) * gd_mult(row.home_score - row.away_score)
    delta = k * (actual_h - exp_h)
    elo[h] = eh + delta
    elo[a] = ea - delta

mapped["home_elo"] = home_elos
mapped["away_elo"] = away_elos
mapped["elo_diff"] = mapped["home_elo"] - mapped["away_elo"] + np.where(mapped["neutral"], 0, HOME_ADV)
print("Final Elo top 15:")
top = pd.Series(elo).sort_values(ascending=False).head(15)
print(top.round(0))
""")

md(r"""
### 3.3 Online attack/defence, rest, and congestion

These features are updated one match at a time. Every row sees only information
available before kickoff. Team strengths decay gently during inactivity, which
helps the model adapt to changing generations without discarding older evidence.
""")

code(r"""
from collections import defaultdict, deque

ATTACK_HALF_LIFE_DAYS = 4 * 365.25
GOAL_HOME_BASE = math.log(1.35)
GOAL_AWAY_BASE = math.log(1.05)

attack = defaultdict(float)
defence_weakness = defaultdict(float)
strength_date = {}
last_match_date = {}
recent_dates = defaultdict(deque)

online_cols = {
    "attack_diff": np.zeros(len(mapped)),
    "defence_diff": np.zeros(len(mapped)),
    "poisson_lh": np.zeros(len(mapped)),
    "poisson_la": np.zeros(len(mapped)),
    "rest_diff": np.zeros(len(mapped)),
    "congestion_diff": np.zeros(len(mapped)),
}

def decayed_strength(team, match_date):
    previous = strength_date.get(team)
    if previous is not None:
        days = max(0, (match_date - previous).days)
        decay = 0.5 ** (days / ATTACK_HALF_LIFE_DAYS)
        attack[team] *= decay
        defence_weakness[team] *= decay
    strength_date[team] = match_date
    return attack[team], defence_weakness[team]

for i, row in enumerate(mapped.itertuples(index=False)):
    h, a, match_date = row.home_code, row.away_code, row.date
    ah, dh = decayed_strength(h, match_date)
    aa, da = decayed_strength(a, match_date)

    home_log_rate = GOAL_HOME_BASE + ah + da + (0.0 if row.neutral else 0.08)
    away_log_rate = GOAL_AWAY_BASE + aa + dh
    lh = float(np.clip(np.exp(home_log_rate), 0.15, 5.0))
    la = float(np.clip(np.exp(away_log_rate), 0.15, 5.0))

    home_rest = min(120, (match_date - last_match_date[h]).days) if h in last_match_date else 60
    away_rest = min(120, (match_date - last_match_date[a]).days) if a in last_match_date else 60
    cutoff = match_date - pd.Timedelta(days=30)
    while recent_dates[h] and recent_dates[h][0] < cutoff:
        recent_dates[h].popleft()
    while recent_dates[a] and recent_dates[a][0] < cutoff:
        recent_dates[a].popleft()

    online_cols["attack_diff"][i] = ah - aa
    online_cols["defence_diff"][i] = da - dh
    online_cols["poisson_lh"][i] = lh
    online_cols["poisson_la"][i] = la
    online_cols["rest_diff"][i] = np.clip(home_rest - away_rest, -60, 60)
    online_cols["congestion_diff"][i] = len(recent_dates[a]) - len(recent_dates[h])

    update_rate = {1: 0.018, 2: 0.024, 3: 0.030, 4: 0.036}.get(row.tier, 0.024)
    err_h = float(np.clip(row.home_score - lh, -3.0, 3.0))
    err_a = float(np.clip(row.away_score - la, -3.0, 3.0))
    attack[h] = float(np.clip(ah + update_rate * err_h, -1.1, 1.1))
    defence_weakness[a] = float(np.clip(da + update_rate * err_h, -1.1, 1.1))
    attack[a] = float(np.clip(aa + update_rate * err_a, -1.1, 1.1))
    defence_weakness[h] = float(np.clip(dh + update_rate * err_a, -1.1, 1.1))
    last_match_date[h] = last_match_date[a] = match_date
    recent_dates[h].append(match_date)
    recent_dates[a].append(match_date)

for col, values in online_cols.items():
    mapped[col] = values
mapped["poisson_goal_diff"] = mapped["poisson_lh"] - mapped["poisson_la"]
print("Online strength/context features added without look-ahead")
""")

md(r"""
### 3.4 Rolling form features
""")

code(r"""
def add_rolling(df, code_col, gf_col, ga_col, prefix):
    # For each team, compute rolling stats over LAST N matches BEFORE current row.
    # Done by stacking matches per team into a long table, sorting by date, shift then rolling.
    long = pd.concat([
        df[[code_col, "date", gf_col, ga_col]].rename(columns={code_col: "team", gf_col: "gf", ga_col: "ga"}),
    ]).copy()
    return long

# Build a unified long table of (team, date, gf, ga, result_pts) and compute rolling features.
home_part = mapped[["date", "home_code", "home_score", "away_score"]].rename(
    columns={"home_code": "team", "home_score": "gf", "away_score": "ga"})
away_part = mapped[["date", "away_code", "away_score", "home_score"]].rename(
    columns={"away_code": "team", "away_score": "gf", "home_score": "ga"})
long = pd.concat([home_part, away_part], ignore_index=True).sort_values(["team", "date"]).reset_index(drop=True)
long["pts"] = np.where(long["gf"] > long["ga"], 3, np.where(long["gf"] == long["ga"], 1, 0))

# Shift by 1 so the row never includes itself
for n in (5, 10):
    long[f"pts_l{n}"] = long.groupby("team")["pts"].transform(lambda s: s.shift(1).rolling(n, min_periods=1).mean())
    long[f"gf_l{n}"]  = long.groupby("team")["gf" ].transform(lambda s: s.shift(1).rolling(n, min_periods=1).mean())
    long[f"ga_l{n}"]  = long.groupby("team")["ga" ].transform(lambda s: s.shift(1).rolling(n, min_periods=1).mean())

# Most-recent rolling stats per team as of a given date — fast lookup via reset
long = long.sort_values(["team", "date"]).reset_index(drop=True)

def join_form(df, code_col, side):
    keys = df[[code_col, "date"]].rename(columns={code_col: "team"})
    keys["__row"] = np.arange(len(keys))
    merged = pd.merge_asof(
        keys.sort_values("date"),
        long.sort_values("date"),
        on="date", by="team", direction="backward", allow_exact_matches=False,
    ).sort_values("__row")
    for col in ["pts_l5","gf_l5","ga_l5","pts_l10","gf_l10","ga_l10"]:
        df[f"{side}_{col}"] = merged[col].values
    return df

mapped = join_form(mapped, "home_code", "h")
mapped = join_form(mapped, "away_code", "a")
mapped.head(3)
""")

md(r"""
### 3.5 FIFA ranking-point difference

Genuinely orthogonal to Elo (different formula, monthly cadence, manual
adjustments). We join the closest prior ranking row per team via merge-asof.
""")

code(r"""
# Locate the ranking columns
rk = ranking.copy()
team_col = next((c for c in rk.columns if "country" in c.lower() and "code" not in c.lower()), None)
pts_col = next((c for c in rk.columns if "total" in c.lower() and "point" in c.lower()), None)
if pts_col is None:
    pts_col = next((c for c in rk.columns if "point" in c.lower()), None)
print("rank cols ->", team_col, pts_col)

rk = rk[[team_col, "date", pts_col]].rename(columns={team_col: "team", pts_col: "rank_pts"})
rk["rank_date"] = rk["date"]
rk["team_code"] = rk["team"].map(to_code)
rk = rk.dropna(subset=["team_code"]).sort_values("date")

def join_rank(df, code_col, side):
    keys = df[[code_col, "date"]].rename(columns={code_col: "team_code"})
    keys["__row"] = np.arange(len(keys))
    merged = pd.merge_asof(
        keys.sort_values("date"),
        rk[["team_code", "date", "rank_date", "rank_pts"]].sort_values("date"),
        on="date", by="team_code", direction="backward", allow_exact_matches=False,
    ).sort_values("__row")
    df[f"{side}_rank_pts"] = merged["rank_pts"].values
    df[f"{side}_rank_date"] = merged["rank_date"].values
    return df

mapped = join_rank(mapped, "home_code", "h")
mapped = join_rank(mapped, "away_code", "a")
mapped["rank_age_days"] = np.maximum(
    (mapped["date"] - mapped["h_rank_date"]).dt.days.fillna(3650),
    (mapped["date"] - mapped["a_rank_date"]).dt.days.fillna(3650),
)
mapped["rank_freshness"] = np.exp(-mapped["rank_age_days"] / 365.25)
mapped["rank_diff"] = (
    mapped["h_rank_pts"].fillna(0) - mapped["a_rank_pts"].fillna(0)
) * mapped["rank_freshness"]
print("rank join coverage:",
      f"{mapped['h_rank_pts'].notna().mean()*100:.0f}% home,",
      f"{mapped['a_rank_pts'].notna().mean()*100:.0f}% away")
""")

md(r"""
### 3.6 Final feature table + time-based split

The compact feature set mixes independent rating systems and match context.
Short and long form are both retained, while stale FIFA rankings are
automatically shrunk toward neutral.
""")

code(r"""
mapped["host"] = (~mapped["neutral"]).astype(int)
mapped["tier"] = mapped["tier"].astype(int)
mapped["gd_diff_l5"] = (mapped["h_gf_l5"] - mapped["h_ga_l5"]) - (mapped["a_gf_l5"] - mapped["a_ga_l5"])
mapped["gd_diff_l10"] = (mapped["h_gf_l10"] - mapped["h_ga_l10"]) - (mapped["a_gf_l10"] - mapped["a_ga_l10"])
mapped["form_diff_l5"] = mapped["h_pts_l5"].fillna(0) - mapped["a_pts_l5"].fillna(0)
mapped["form_diff_l10"] = mapped["h_pts_l10"].fillna(0) - mapped["a_pts_l10"].fillna(0)

FEATURES = [
    "elo_diff", "home_elo", "away_elo",
    "rank_diff", "rank_freshness",
    "host", "tier",
    "form_diff_l5", "gd_diff_l5",
    "form_diff_l10", "gd_diff_l10",
    "attack_diff", "defence_diff",
    "poisson_lh", "poisson_la", "poisson_goal_diff",
    "rest_diff", "congestion_diff",
]

ds = mapped.dropna(subset=["elo_diff", "home_elo", "away_elo"]).copy()
# rank_diff and form_diff may be NaN for very early matches — impute with 0 (neutral)
for c in FEATURES:
    ds[c] = ds[c].fillna(0)

ds["y_cls"] = ds["result"].map({"H": 0, "D": 1, "A": 2})
print(f"Modeling rows: {len(ds):,}")

train = ds[ds["date"] < "2022-01-01"]
val   = ds[(ds["date"] >= "2022-01-01") & (ds["date"] < "2024-01-01")]
test  = ds[ds["date"] >= "2024-01-01"]
print(f"train: {len(train):,}   val: {len(val):,}   test: {len(test):,}")

X_train, y_train = train[FEATURES], train["y_cls"]
X_val,   y_val   = val[FEATURES],   val["y_cls"]
X_test,  y_test  = test[FEATURES],  test["y_cls"]

def recency_weights(frame, reference_date, half_life_years):
    age_years = np.maximum(0, (pd.Timestamp(reference_date) - frame["date"]).dt.days / 365.25)
    weights = np.maximum(0.05, 0.5 ** (age_years / half_life_years))
    return weights / weights.mean()
""")

# =============================================================================
md(r"""
## Phase 4 — Modeling

### 4.1 Baseline: Elo-only multinomial logistic regression
""")

code(r"""
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import log_loss, brier_score_loss

def rps(y_true, p):
    # Ranked Probability Score for 3-class ordered outcome (H, D, A).
    cum_p = np.cumsum(p, axis=1)
    cum_y = np.cumsum(np.eye(3)[y_true], axis=1)
    return float(np.mean(np.sum((cum_p - cum_y) ** 2, axis=1)) / 2.0)

baseline = LogisticRegression(max_iter=1000).fit(train[["elo_diff"]], y_train)
p_base_test = baseline.predict_proba(test[["elo_diff"]])

print(f"Baseline (Elo-only) test log-loss: {log_loss(y_test, p_base_test):.4f}")
print(f"Baseline (Elo-only) test RPS:      {rps(y_test.values, p_base_test):.4f}")
""")

md(r"""
### 4.2 Walk-forward classifier selection
""")

code(r"""
import xgboost as xgb
import optuna

optuna.logging.set_verbosity(optuna.logging.WARNING)

CV_WINDOWS = [
    ("2018-01-01", "2020-01-01"),
    ("2020-01-01", "2022-01-01"),
    ("2022-01-01", "2024-01-01"),
]

def objective(trial):
    half_life_years = trial.suggest_categorical("half_life_years", [4.0, 6.0, 8.0, 12.0])
    params = dict(
        objective="multi:softprob", num_class=3, eval_metric="mlogloss",
        tree_method="hist", n_jobs=-1, random_state=42,
        n_estimators=700,
        max_depth=trial.suggest_int("max_depth", 2, 5),
        learning_rate=trial.suggest_float("learning_rate", 0.015, 0.08, log=True),
        min_child_weight=trial.suggest_int("min_child_weight", 4, 20),
        subsample=trial.suggest_float("subsample", 0.65, 0.95),
        colsample_bytree=trial.suggest_float("colsample_bytree", 0.6, 0.9),
        reg_lambda=trial.suggest_float("reg_lambda", 1.0, 12.0, log=True),
        reg_alpha=trial.suggest_float("reg_alpha", 0.01, 2.0, log=True),
    )
    fold_losses = []
    for fold_start, fold_end in CV_WINDOWS:
        fold_train = ds[ds["date"] < fold_start]
        fold_val = ds[(ds["date"] >= fold_start) & (ds["date"] < fold_end)]
        weights = recency_weights(fold_train, pd.Timestamp(fold_start), half_life_years)
        m = xgb.XGBClassifier(early_stopping_rounds=35, **params)
        m.fit(
            fold_train[FEATURES], fold_train["y_cls"],
            sample_weight=weights,
            eval_set=[(fold_val[FEATURES], fold_val["y_cls"])],
            verbose=False,
        )
        fold_losses.append(log_loss(fold_val["y_cls"], m.predict_proba(fold_val[FEATURES]), labels=[0,1,2]))
    trial.set_user_attr("fold_losses", fold_losses)
    return float(np.mean(fold_losses))

study = optuna.create_study(direction="minimize", sampler=optuna.samplers.TPESampler(seed=42))
study.optimize(objective, n_trials=24, show_progress_bar=False)
print(f"best walk-forward mean log-loss: {study.best_value:.4f}")
print("fold log-losses:", [round(x, 4) for x in study.best_trial.user_attrs["fold_losses"]])
print("best params:", study.best_params)

BEST_HALF_LIFE = float(study.best_params["half_life_years"])
BEST_XGB_PARAMS = {k: v for k, v in study.best_params.items() if k != "half_life_years"}
xgb_clf = xgb.XGBClassifier(
    objective="multi:softprob", num_class=3, eval_metric="mlogloss",
    tree_method="hist", n_jobs=-1, random_state=42,
    n_estimators=900, early_stopping_rounds=40,
    **BEST_XGB_PARAMS,
)
train_weights = recency_weights(train, pd.Timestamp("2022-01-01"), BEST_HALF_LIFE)
xgb_clf.fit(
    X_train, y_train, sample_weight=train_weights,
    eval_set=[(X_val, y_val)], verbose=False,
)
p_xgb_test = xgb_clf.predict_proba(X_test)
print(f"XGB classifier test log-loss: {log_loss(y_test, p_xgb_test):.4f}")
print(f"XGB classifier test RPS:      {rps(y_test.values, p_xgb_test):.4f}")

# A regularized linear model is a strong low-variance challenger. Select the
# classifier family and regularization only from walk-forward validation.
linear_trials = []
for C in [0.003, 0.01, 0.03, 0.1, 0.3]:
    fold_losses = []
    for fold_start, fold_end in CV_WINDOWS:
        fold_train = ds[ds["date"] < fold_start]
        fold_val = ds[(ds["date"] >= fold_start) & (ds["date"] < fold_end)]
        weights = recency_weights(fold_train, pd.Timestamp(fold_start), BEST_HALF_LIFE)
        model = make_pipeline(
            StandardScaler(),
            LogisticRegression(C=C, max_iter=1500, random_state=42),
        )
        model.fit(
            fold_train[FEATURES], fold_train["y_cls"],
            logisticregression__sample_weight=weights,
        )
        fold_losses.append(log_loss(
            fold_val["y_cls"], model.predict_proba(fold_val[FEATURES]), labels=[0,1,2]
        ))
    linear_trials.append((float(np.mean(fold_losses)), C, fold_losses))

LINEAR_CV_LOSS, LINEAR_C, LINEAR_FOLD_LOSSES = min(linear_trials, key=lambda row: row[0])
linear_clf = make_pipeline(
    StandardScaler(),
    LogisticRegression(C=LINEAR_C, max_iter=1500, random_state=42),
)
linear_clf.fit(X_train, y_train, logisticregression__sample_weight=train_weights)
p_linear_test = linear_clf.predict_proba(X_test)

if LINEAR_CV_LOSS <= study.best_value:
    CLASSIFIER_KIND = "regularized_multinomial"
    clf = linear_clf
    p_clf_test = p_linear_test
    classifier_cv_loss = LINEAR_CV_LOSS
else:
    CLASSIFIER_KIND = "xgboost"
    clf = xgb_clf
    p_clf_test = p_xgb_test
    classifier_cv_loss = float(study.best_value)

print(f"Selected classifier: {CLASSIFIER_KIND} (walk-forward LL={classifier_cv_loss:.4f})")
print(f"Selected classifier test log-loss: {log_loss(y_test, p_clf_test):.4f}")
print(f"Selected classifier test RPS:      {rps(y_test.values, p_clf_test):.4f}")
""")

md(r"""
### 4.3 Poisson goals model + Dixon–Coles low-score correction

We fit one Poisson regressor each for home/away goal expectations (λ_h, λ_a).
The Dixon–Coles ρ adjusts the joint distribution for low scorelines
(0-0, 1-1, 1-0, 0-1) where independence of the two Poissons is empirically wrong.
""")

code(r"""
reg_h = xgb.XGBRegressor(
    objective="count:poisson", n_estimators=500, max_depth=4, learning_rate=0.05,
    subsample=0.9, colsample_bytree=0.8, min_child_weight=4, reg_lambda=1.5,
    tree_method="hist", early_stopping_rounds=30, n_jobs=-1, random_state=42,
)
reg_a = xgb.XGBRegressor(
    objective="count:poisson", n_estimators=500, max_depth=4, learning_rate=0.05,
    subsample=0.9, colsample_bytree=0.8, min_child_weight=4, reg_lambda=1.5,
    tree_method="hist", early_stopping_rounds=30, n_jobs=-1, random_state=42,
)
reg_h.fit(
    X_train, train["home_score"].clip(0, 8), sample_weight=train_weights,
    eval_set=[(X_val, val["home_score"].clip(0,8))], verbose=False,
)
reg_a.fit(
    X_train, train["away_score"].clip(0, 8), sample_weight=train_weights,
    eval_set=[(X_val, val["away_score"].clip(0,8))], verbose=False,
)

lh_test = np.clip(reg_h.predict(X_test), 0.05, 6.0)
la_test = np.clip(reg_a.predict(X_test), 0.05, 6.0)
print(f"mean predicted λ_home={lh_test.mean():.2f}, λ_away={la_test.mean():.2f}")
print(f"actual   mean home={test['home_score'].mean():.2f}, away={test['away_score'].mean():.2f}")
""")

code(r"""
from math import exp, lgamma, log

def poisson_pmf(k, lam):
    return np.exp(k * np.log(lam) - lam - np.array([math.lgamma(kk+1) for kk in k]))

def dixon_coles_tau(h, a, lh, la, rho):
    # Adjustment factor for low scorelines
    if h == 0 and a == 0: return 1 - lh * la * rho
    if h == 0 and a == 1: return 1 + lh * rho
    if h == 1 and a == 0: return 1 + la * rho
    if h == 1 and a == 1: return 1 - rho
    return 1.0

def score_matrix(lh, la, rho=0.0, max_goals=8):
    ks = np.arange(max_goals + 1)
    ph = np.exp(ks * np.log(lh) - lh - np.array([math.lgamma(k+1) for k in ks]))
    pa = np.exp(ks * np.log(la) - la - np.array([math.lgamma(k+1) for k in ks]))
    M = np.outer(ph, pa)
    if rho != 0.0:
        for h, a in [(0,0),(0,1),(1,0),(1,1)]:
            M[h, a] *= dixon_coles_tau(h, a, lh, la, rho)
    M /= M.sum()
    return M

def wdl_from_matrix(M):
    h = float(np.tril(M, -1).sum())  # home > away
    a = float(np.triu(M,  1).sum())  # away > home
    d = float(np.trace(M))
    return np.array([h, d, a])

# Fit rho on the validation set (small 1-D search)
lh_val = np.clip(reg_h.predict(X_val), 0.05, 6.0)
la_val = np.clip(reg_a.predict(X_val), 0.05, 6.0)
val_actual = list(zip(val["home_score"].clip(0,8).astype(int).tolist(),
                      val["away_score"].clip(0,8).astype(int).tolist()))

def dc_ll(rho):
    ll = 0.0
    for (h,a), lh, la in zip(val_actual, lh_val, la_val):
        M = score_matrix(lh, la, rho=rho, max_goals=8)
        ll += np.log(max(M[h, a], 1e-12))
    return -ll

from scipy.optimize import minimize_scalar
res = minimize_scalar(dc_ll, bounds=(-0.2, 0.2), method="bounded", options={"xatol":1e-4})
RHO = float(res.x)
print(f"Fitted Dixon-Coles rho = {RHO:.4f}")
""")

md(r"""
### 4.4 Ensemble + temperature scaling

Previous version used **isotonic regression** per class for calibration — at
this dataset size it overfit validation (raw 0.973 LL → calibrated 1.001 LL on
test). We replace it with **temperature scaling**: one scalar τ optimized on
validation log-loss. Three orders of magnitude fewer parameters → can't overfit.
""")

code(r"""
def goals_to_wdl(lh_arr, la_arr, rho=RHO):
    out = np.zeros((len(lh_arr), 3))
    for i, (lh, la) in enumerate(zip(lh_arr, la_arr)):
        out[i] = wdl_from_matrix(score_matrix(lh, la, rho=rho))
    return out

p_goals_val = goals_to_wdl(np.clip(reg_h.predict(X_val),0.05,6.0),
                            np.clip(reg_a.predict(X_val),0.05,6.0))
p_clf_val   = clf.predict_proba(X_val)

# Search blend weight by validation log-loss
best = (None, 1e9)
for w in np.linspace(0, 1, 21):
    p = w * p_clf_val + (1 - w) * p_goals_val
    p = p / p.sum(axis=1, keepdims=True)
    ll = log_loss(y_val, p, labels=[0,1,2])
    if ll < best[1]:
        best = (float(w), float(ll))
W_CLF = best[0]
print(f"Ensemble blend: w_clf={W_CLF:.2f} (val log-loss={best[1]:.4f})")

p_goals_test = goals_to_wdl(lh_test, la_test)
p_raw_test = W_CLF * p_clf_test + (1 - W_CLF) * p_goals_test
p_raw_test = p_raw_test / p_raw_test.sum(axis=1, keepdims=True)

p_val_raw = W_CLF * p_clf_val + (1 - W_CLF) * p_goals_val
p_val_raw = p_val_raw / p_val_raw.sum(axis=1, keepdims=True)

def temp_scale(p, T):
    logits = np.log(np.clip(p, 1e-9, 1))
    z = logits / T
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)

from scipy.optimize import minimize_scalar
res_T = minimize_scalar(
    lambda T: log_loss(y_val, temp_scale(p_val_raw, T)),
    bounds=(0.5, 3.0), method="bounded", options={"xatol": 1e-4},
)
T_OPT = float(res_T.x)
print(f"Temperature τ = {T_OPT:.3f}   val log-loss: raw {log_loss(y_val, p_val_raw):.4f} -> τ-scaled {res_T.fun:.4f}")

p_cal_test = temp_scale(p_raw_test, T_OPT)
assert np.allclose(p_cal_test.sum(axis=1), 1.0, atol=1e-6)
print("Calibrated probabilities sum to 1 ✓")
""")

# =============================================================================
md(r"""
## Phase 5 — Evaluation
""")

code(r"""
results_table = pd.DataFrame([
    ("Elo-only baseline",          log_loss(y_test, p_base_test), rps(y_test.values, p_base_test)),
    ("XGB classifier only",        log_loss(y_test, p_xgb_test),  rps(y_test.values, p_xgb_test)),
    (f"Selected: {CLASSIFIER_KIND}",log_loss(y_test, p_clf_test),  rps(y_test.values, p_clf_test)),
    ("Poisson goals -> W/D/L",     log_loss(y_test, p_goals_test),rps(y_test.values, p_goals_test)),
    ("Ensemble (raw)",             log_loss(y_test, p_raw_test),  rps(y_test.values, p_raw_test)),
    ("Ensemble (calibrated) ★",    log_loss(y_test, p_cal_test),  rps(y_test.values, p_cal_test)),
], columns=["Model", "Log-loss", "RPS"]).round(4)
results_table
""")

code(r"""
# Reliability diagram — used on the methodology page of the site
from sklearn.calibration import calibration_curve

fig, ax = plt.subplots(figsize=(6, 6))
for cls, label, color in [(0, "Home win", "#0a84ff"), (1, "Draw", "#8e8e93"), (2, "Away win", "#ff453a")]:
    prob_true, prob_pred = calibration_curve((y_test == cls).astype(int), p_cal_test[:, cls], n_bins=10, strategy="quantile")
    ax.plot(prob_pred, prob_true, "o-", color=color, label=label)
ax.plot([0,1],[0,1], "--", color="#444")
ax.set_xlabel("Predicted probability"); ax.set_ylabel("Empirical frequency")
ax.set_title("Reliability diagram — calibrated ensemble (held-out 2024+ test)")
ax.legend()
plt.tight_layout()
calib_path = WEB_DATA / "calibration.png"
plt.savefig(calib_path, dpi=140, bbox_inches="tight")
print("Saved", calib_path)
plt.show()
""")

code(r"""
# Refit production models on every completed match after holdout evaluation.
production_weights = recency_weights(
    ds, ds["date"].max() + pd.Timedelta(days=1), BEST_HALF_LIFE
)
if CLASSIFIER_KIND == "regularized_multinomial":
    clf = make_pipeline(
        StandardScaler(),
        LogisticRegression(C=LINEAR_C, max_iter=1500, random_state=42),
    )
    clf.fit(
        ds[FEATURES], ds["y_cls"],
        logisticregression__sample_weight=production_weights,
    )
else:
    clf = xgb.XGBClassifier(
        objective="multi:softprob", num_class=3, eval_metric="mlogloss",
        tree_method="hist", n_jobs=-1, random_state=42,
        n_estimators=max(1, int(xgb_clf.best_iteration) + 1),
        **BEST_XGB_PARAMS,
    )
    clf.fit(ds[FEATURES], ds["y_cls"], sample_weight=production_weights, verbose=False)

reg_h = xgb.XGBRegressor(
    objective="count:poisson", n_estimators=max(1, int(reg_h.best_iteration) + 1),
    max_depth=4, learning_rate=0.05, subsample=0.9, colsample_bytree=0.8,
    min_child_weight=4, reg_lambda=1.5, tree_method="hist", n_jobs=-1, random_state=42,
)
reg_a = xgb.XGBRegressor(
    objective="count:poisson", n_estimators=max(1, int(reg_a.best_iteration) + 1),
    max_depth=4, learning_rate=0.05, subsample=0.9, colsample_bytree=0.8,
    min_child_weight=4, reg_lambda=1.5, tree_method="hist", n_jobs=-1, random_state=42,
)
reg_h.fit(
    ds[FEATURES], ds["home_score"].clip(0, 8),
    sample_weight=production_weights, verbose=False,
)
reg_a.fit(
    ds[FEATURES], ds["away_score"].clip(0, 8),
    sample_weight=production_weights, verbose=False,
)
print(f"Production models refit through {ds['date'].max().date()} on {len(ds):,} completed matches")
""")

# =============================================================================
md(r"""
## Phase 6 — Deployment: export JSON artifacts for the Next.js site

We build:
- `teams.json` — 48 teams with iso code (for flags), group, current Elo
- `schedule.json` — 104 matches (group stage authored; knockout slots use bracket mapping)
- `pairwise.json` — for every ordered pair of the 48 teams: λ_home, λ_away, calibrated P(W/D/L)
- `meta.json` — model version, train date, metrics
""")

code(r"""
WC_TEAMS = json.loads((RAW / "wc2026_teams.json").read_text(encoding="utf-8"))
GROUPS = WC_TEAMS["groups"]  # {"A": ["MEX","POL","CHL","MAR"], ...}
TEAMS_META = {t["code"]: t for t in WC_TEAMS["teams"]}

# Ensure every WC team has at least an INIT_ELO (fallback for teams with no recent matches in our data)
for c in TEAMS_META:
    if c not in elo:
        elo[c] = INIT_ELO - 50  # slightly below average — they made the WC so not too low

teams_out = []
for code_, meta in TEAMS_META.items():
    group_letter = next(g for g, members in GROUPS.items() if code_ in members)
    teams_out.append({
        "code": code_,
        "name": meta["name"],
        "iso2": meta["iso2"],
        "confederation": meta["confederation"],
        "host": bool(meta.get("host", False)),
        "group": group_letter,
        "elo": round(elo[code_], 1),
    })
teams_out.sort(key=lambda t: (t["group"], -t["elo"]))
(WEB_DATA / "teams.json").write_text(json.dumps(teams_out, indent=2), encoding="utf-8")
(ART / "teams.json").write_text(json.dumps(teams_out, indent=2), encoding="utf-8")
print(f"teams.json: {len(teams_out)} teams")
""")

code(r"""
# Build the 104-match schedule.
# Group stage: 6 matches per group (1v2, 3v4, 1v3, 2v4, 1v4, 2v3) — standard rotation.
GROUP_LETTERS = list("ABCDEFGHIJKL")
team_to_group = {
    team_code: group
    for group, members in GROUPS.items()
    for team_code in members
}
wc_fixtures = pd.DataFrame([
    {
        "date": pd.Timestamp(fixture["date"]),
        "home_team": fixture["team1"],
        "away_team": fixture["team2"],
        "home_score": fixture.get("score", {}).get("ft", [None, None])[0],
        "away_score": fixture.get("score", {}).get("ft", [None, None])[1],
        "neutral": fixture["team1"] not in {"Mexico", "Canada", "United States"},
        "group": fixture["group"].replace("Group ", ""),
    }
    for fixture in wc_live_matches
    if fixture.get("group", "").startswith("Group ")
])
wc_fixtures["home_code"] = wc_fixtures["home_team"].map(to_code)
wc_fixtures["away_code"] = wc_fixtures["away_team"].map(to_code)
wc_fixtures = wc_fixtures[
    wc_fixtures["home_code"].map(team_to_group).eq(wc_fixtures["group"])
    & (wc_fixtures["away_code"].map(team_to_group) == wc_fixtures["group"])
].sort_values(["date", "group"]).reset_index(drop=True)

assert len(wc_fixtures) == 72, f"Expected 72 official group fixtures, got {len(wc_fixtures)}"

group_round_dates = {
    group: {
        match_date: index + 1
        for index, match_date in enumerate(sorted(group_rows["date"].dt.strftime("%Y-%m-%d").unique()))
    }
    for group, group_rows in wc_fixtures.groupby("group")
}

schedule = []
for index, row in wc_fixtures.iterrows():
    date_str = row["date"].strftime("%Y-%m-%d")
    completed = pd.notna(row["home_score"]) and pd.notna(row["away_score"])
    fixture = {
        "id": f"G{index + 1:03d}",
        "stage": "group",
        "group": row["group"],
        "round": group_round_dates[row["group"]][date_str],
        "date": date_str,
        "home": row["home_code"],
        "away": row["away_code"],
        "neutral": bool(row["neutral"]),
        "completed": bool(completed),
    }
    if completed:
        fixture["homeScore"] = int(row["home_score"])
        fixture["awayScore"] = int(row["away_score"])
    schedule.append(fixture)

assert len(schedule) == 72, f"Expected 72 group matches, got {len(schedule)}"
assert all(sum(match["group"] == group for match in schedule) == 6 for group in GROUP_LETTERS)
assert all(
    sum(team_code in (match["home"], match["away"]) for match in schedule) == 3
    for team_code in TEAMS_META
)

# Round of 32 bracket: maps to 16 slots. We use a deterministic mapping that
# alternates group winners / runners-up / third-placed across the bracket.
# (The official 2026 bracket is published; this mapping mirrors that structure.)
R32_SLOTS = [
    ("1A", "2C"), ("1D", "3B/E/F"),
    ("1E", "3A/B/C/D"), ("1B", "3F/H/I/J"),
    ("1F", "2I"), ("1C", "3G/H/J/K"),
    ("1G", "3A/E/H/L"), ("2B", "2F"),
    ("1H", "2L"), ("1K", "3D/E/I/L"),
    ("1L", "2J"), ("2A", "2K"),
    ("1I", "2H"), ("1J", "2E"),
    ("2D", "2G"), ("3-best-vs-3-best", "placeholder"),
]
# To keep the simulation deterministic and the site's bracket-mapping logic
# self-contained, we encode the actual third-place picker logic in the worker.
# The slots list above is illustrative; the worker uses the FIFA mapping table.

KO_DATES = {"R32": "2026-06-28", "R16": "2026-07-04", "QF": "2026-07-09", "SF": "2026-07-14", "3RD": "2026-07-18", "F": "2026-07-19"}
for stage, count in [("R32", 16), ("R16", 8), ("QF", 4), ("SF", 2), ("3RD", 1), ("F", 1)]:
    for i in range(1, count + 1):
        schedule.append({
            "id": f"{stage}{i:02d}",
            "stage": stage,
            "date": KO_DATES[stage],
            "home": None, "away": None, "neutral": True,
        })

assert len(schedule) == 104, f"Expected 104 matches, got {len(schedule)}"
(WEB_DATA / "schedule.json").write_text(json.dumps(schedule, indent=2), encoding="utf-8")
(ART / "schedule.json").write_text(json.dumps(schedule, indent=2), encoding="utf-8")
print(f"schedule.json: {len(schedule)} matches")
""")

code(r"""
# Build pairwise.json: for every ordered (home, away) pair of the 48 teams,
# compute lambda_home, lambda_away, and calibrated W/D/L.
# This is the single source of truth consumed by the browser Monte Carlo.

team_codes = [t["code"] for t in teams_out]

# Build a features row for an arbitrary fixture.
# Rolling-form lookups: use the most recent stats in our long table per team (as of today's data).
last_form = (
    long.sort_values("date").groupby("team").tail(1)
        .set_index("team")[["pts_l5","gf_l5","ga_l5","pts_l10","gf_l10","ga_l10"]]
)

# Fallback (team with no rows) — league average
form_avg = last_form.mean().to_dict()

def form_for(code_):
    team_rows = long[long["team"] == code_].sort_values("date")
    if team_rows.empty:
        return {"pts_l5": 1.0, "gf_l5": 1.1, "ga_l5": 1.1,
                "pts_l10": 1.0, "gf_l10": 1.1, "ga_l10": 1.1}
    out = {}
    for n in (5, 10):
        recent = team_rows.tail(n)
        out[f"pts_l{n}"] = float(recent["pts"].mean())
        out[f"gf_l{n}"] = float(recent["gf"].mean())
        out[f"ga_l{n}"] = float(recent["ga"].mean())
    return out

# Most recent FIFA ranking points per team. Old values are softly ignored.
last_rank_rows = rk.sort_values("date").groupby("team_code").tail(1).set_index("team_code")
def rank_for(code_):
    if code_ not in last_rank_rows.index:
        return 0.0, 0.0
    row = last_rank_rows.loc[code_]
    age_days = max(0, (ds["date"].max() - row["rank_date"]).days)
    freshness = float(np.exp(-age_days / 365.25))
    return float(row["rank_pts"]), freshness

def make_features(home, away, neutral=True, tier_=4):
    fh = form_for(home); fa = form_for(away)
    eh, ea = elo[home], elo[away]
    adv = 0.0 if neutral else HOME_ADV
    rh, fh_rank = rank_for(home)
    ra, fa_rank = rank_for(away)
    rank_freshness = min(fh_rank, fa_rank)
    ah, aa = float(attack[home]), float(attack[away])
    dh, da = float(defence_weakness[home]), float(defence_weakness[away])
    lh = float(np.clip(np.exp(GOAL_HOME_BASE + ah + da + (0.0 if neutral else 0.08)), 0.15, 5.0))
    la = float(np.clip(np.exp(GOAL_AWAY_BASE + aa + dh), 0.15, 5.0))
    form_diff_l5 = fh["pts_l5"] - fa["pts_l5"]
    gd_diff_l5 = (fh["gf_l5"] - fh["ga_l5"]) - (fa["gf_l5"] - fa["ga_l5"])
    form_diff = fh["pts_l10"] - fa["pts_l10"]
    gd_diff = (fh["gf_l10"] - fh["ga_l10"]) - (fa["gf_l10"] - fa["ga_l10"])
    return {
        "elo_diff": eh + adv - ea,
        "home_elo": eh, "away_elo": ea,
        "rank_diff": (rh - ra) * rank_freshness,
        "rank_freshness": rank_freshness,
        "host": 0 if neutral else 1,
        "tier": tier_,
        "form_diff_l5": form_diff_l5,
        "gd_diff_l5": gd_diff_l5,
        "form_diff_l10": form_diff,
        "gd_diff_l10": gd_diff,
        "attack_diff": ah - aa,
        "defence_diff": da - dh,
        "poisson_lh": lh,
        "poisson_la": la,
        "poisson_goal_diff": lh - la,
        "rest_diff": 0.0,
        "congestion_diff": 0.0,
    }

# Build a big DataFrame of all (home, away) pairs for fast batched inference.
HOSTS = {"USA","MEX","CAN"}
rows, keys = [], []
for h in team_codes:
    for a in team_codes:
        if h == a: continue
        neutral = not (h in HOSTS)  # treat host as home; everyone else neutral when on the road
        rows.append(make_features(h, a, neutral=neutral, tier_=4))
        keys.append((h, a))
PAIR_X = pd.DataFrame(rows)[FEATURES]

# Batched model predictions
P_CLF = clf.predict_proba(PAIR_X)
LH = np.clip(reg_h.predict(PAIR_X), 0.05, 6.0)
LA = np.clip(reg_a.predict(PAIR_X), 0.05, 6.0)
P_GOAL = goals_to_wdl(LH, LA)
P_RAW = W_CLF * P_CLF + (1 - W_CLF) * P_GOAL
P_RAW = P_RAW / P_RAW.sum(axis=1, keepdims=True)
P_CAL = temp_scale(P_RAW, T_OPT)

pairwise = {}
for (h, a), lh, la, pwdl in zip(keys, LH, LA, P_CAL):
    pairwise[f"{h}-{a}"] = {
        "lh": round(float(lh), 4),
        "la": round(float(la), 4),
        "pH": round(float(pwdl[0]), 4),
        "pD": round(float(pwdl[1]), 4),
        "pA": round(float(pwdl[2]), 4),
    }
(WEB_DATA / "pairwise.json").write_text(json.dumps(pairwise), encoding="utf-8")
(ART / "pairwise.json").write_text(json.dumps(pairwise), encoding="utf-8")
print(f"pairwise.json: {len(pairwise):,} ordered pairs")
""")

code(r"""
meta = {
    "version": "3.0.0",
    "trained_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
    "dixon_coles_rho": RHO,
    "ensemble_w_clf": W_CLF,
    "temperature": T_OPT,
    "classifier": CLASSIFIER_KIND,
    "recency_half_life_years": BEST_HALF_LIFE,
    "walk_forward_cv": {
        "windows": [f"{start} .. {end}" for start, end in CV_WINDOWS],
        "mean_log_loss": float(classifier_cv_loss),
        "fold_log_loss": [
            float(x) for x in (
                LINEAR_FOLD_LOSSES if CLASSIFIER_KIND == "regularized_multinomial"
                else study.best_trial.user_attrs["fold_losses"]
            )
        ],
        "candidates": {
            "regularized_multinomial": float(LINEAR_CV_LOSS),
            "xgboost": float(study.best_value),
        },
    },
    "features": FEATURES,
    "feature_policy": {
        "pre_match_only": True,
        "player_ratings": "excluded: available only for recent FIFA editions and unsafe to backfill",
        "xg": "online expected-goal proxy from prior international scores; no broad historical xG source",
        "fifa_rankings": "exponentially downweighted when stale",
    },
    "test_metrics": {
        "elo_baseline":  {"log_loss": float(log_loss(y_test, p_base_test)), "rps": rps(y_test.values, p_base_test)},
        "xgb_only":      {"log_loss": float(log_loss(y_test, p_xgb_test)),  "rps": rps(y_test.values, p_xgb_test)},
        "selected_classifier": {
            "name": CLASSIFIER_KIND,
            "log_loss": float(log_loss(y_test, p_clf_test)),
            "rps": rps(y_test.values, p_clf_test),
        },
        "poisson_only":  {"log_loss": float(log_loss(y_test, p_goals_test)),"rps": rps(y_test.values, p_goals_test)},
        "ensemble_raw":  {"log_loss": float(log_loss(y_test, p_raw_test)),  "rps": rps(y_test.values, p_raw_test)},
        "ensemble_cal":  {"log_loss": float(log_loss(y_test, p_cal_test)),  "rps": rps(y_test.values, p_cal_test)},
    },
    "train_window": "<= 2021-12-31",
    "val_window": "2022-01-01 .. 2023-12-31",
    "test_window": ">= 2024-01-01",
    "production_train_window": f"1993-01-01 .. {ds['date'].max().date()}",
    "latest_result_date": str(ds["date"].max().date()),
    "completed_world_cup_matches": int(sum(1 for match in schedule if match.get("completed"))),
    "n_matches_used": int(len(ds)),
}
(WEB_DATA / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
(ART / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
print("meta.json written")
""")

code(r"""
# Save model artifacts (for reproducibility / re-running export without re-training)
import joblib
joblib.dump({"clf": clf, "reg_h": reg_h, "reg_a": reg_a, "temperature": T_OPT,
             "rho": RHO, "w_clf": W_CLF, "elo": dict(elo), "features": FEATURES,
             "attack": dict(attack), "defence_weakness": dict(defence_weakness),
             "recency_half_life_years": BEST_HALF_LIFE,
             "classifier_kind": CLASSIFIER_KIND},
            ART / "models.joblib")
print("Saved", ART / "models.joblib")
""")

md(r"""
---

### Deployment complete

JSON artifacts are now in `web/public/data/`:

- `teams.json` — 48 teams with group + Elo
- `schedule.json` — 104 matches
- `pairwise.json` — calibrated probabilities for every ordered pair
- `meta.json` — model metadata + metrics
- `calibration.png` — reliability diagram for the methodology page

Next: `cd web && npm install && npm run dev` to start the site.
""")

NB = {
    "cells": CELLS,
    "metadata": {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python", "version": "3.13"},
    },
    "nbformat": 4,
    "nbformat_minor": 5,
}

out = Path(__file__).parent / "wc2026_pipeline.ipynb"
out.write_text(json.dumps(NB, indent=1), encoding="utf-8")
print(f"Wrote {out} ({len(CELLS)} cells)")
