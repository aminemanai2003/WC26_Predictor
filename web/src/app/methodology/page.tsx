"use client";
import { Section } from "@/components/Section";
import { meta } from "@/lib/data";
import { Database, Layers, GitBranch, Gauge, Cpu, Sparkles } from "lucide-react";
import CalibrationImage from "@/components/CalibrationImage";
import { useT } from "@/lib/i18n/context";

export default function MethodologyPage() {
  const { t, locale } = useT();
  const m = meta.test_metrics;

  const PHASES = locale === "fr"
    ? [
        { title: "Compréhension métier", icon: Sparkles, body: "Probabilités calibrées pour chaque match du Mondial 2026 et probabilités à l'échelle du tournoi via Monte Carlo. Succès mesuré contre une baseline Elo sur log-loss, Brier et RPS." },
        { title: "Compréhension des données", icon: Database, body: "Deux datasets Kaggle — `martj42/international-football-results-from-1872-to-2017` (~48k matchs) et `cashncarry/fifaworldranking` — joints à un fichier équipes 2026 curé à la main." },
        { title: "Préparation des données", icon: Layers, body: "Époque moderne (1993+), codes équipes normalisés, Elo custom (K-factor pondéré par tier de tournoi et différentiel de buts), forme glissante sur 5/10 matchs, head-to-head — tout calculé chronologiquement (zéro leakage)." },
        { title: "Modélisation", icon: Cpu, body: "Deux modèles en concert : classificateur V/N/D XGBoost et modèle de buts Poisson ajusté Dixon-Coles. Les V/N/D des deux sont mélangés (poids tuné sur log-loss validation) puis passés en temperature scaling." },
        { title: "Évaluation", icon: Gauge, body: "Split temporel (train ≤2017, val 2018-21, test 2022-25). L'ensemble bat la baseline Elo sur chaque métrique, avec une courbe de fiabilité bien alignée. Backtest WC 2022 cohérent." },
        { title: "Déploiement", icon: GitBranch, body: "Artefacts JSON (équipes, calendrier, probas pairwise, métadonnées) exportés depuis le notebook et consommés par ce site. Monte Carlo dans un Web Worker — 10 000 tournois en ~1-2 s, hors-ligne." },
      ]
    : [
        { title: "Business understanding", icon: Sparkles, body: "Calibrated probabilities for every WC 2026 match and tournament-level outcomes via Monte Carlo. Success is measured against an Elo-only baseline on log-loss, Brier, and Ranked Probability Score (RPS)." },
        { title: "Data understanding", icon: Database, body: "Two Kaggle datasets — `martj42/international-football-results-from-1872-to-2017` (~48k matches) and `cashncarry/fifaworldranking` — joined to a hand-curated 2026 team + group file." },
        { title: "Data preparation", icon: Layers, body: "Modern era (1993+), normalized team codes, custom Elo (K-factor scaled by tournament tier and goal-difference multiplier), 5/10-match rolling form, head-to-head — all computed chronologically with leakage protection." },
        { title: "Modeling", icon: Cpu, body: "Two models in concert: XGBoost W/D/L classifier and a Dixon-Coles-adjusted Poisson goals model. Their W/D/L estimates are blended (weight tuned on validation log-loss) then temperature-scaled." },
        { title: "Evaluation", icon: Gauge, body: "Time-based split (train ≤2017, val 2018-21, test 2022-25). The ensemble beats Elo-only on every metric, with a well-aligned reliability curve. A WC 2022 backtest produces sensible champion odds." },
        { title: "Deployment", icon: GitBranch, body: "JSON artifacts (teams, schedule, pairwise probabilities, metadata) are exported from the notebook and consumed by this site. Monte Carlo runs in a Web Worker — 10,000 tournaments in ~1-2 seconds, fully offline." },
      ];

  const rows = [
    [locale === "fr" ? "Baseline Elo seul" : "Elo-only baseline", m?.elo_baseline?.log_loss, m?.elo_baseline?.rps],
    [locale === "fr" ? "Classificateur XGBoost" : "XGBoost classifier", m?.xgb_only?.log_loss, m?.xgb_only?.rps],
    [locale === "fr" ? "Buts Poisson → V/N/D" : "Poisson goals → W/D/L", m?.poisson_only?.log_loss, m?.poisson_only?.rps],
    [locale === "fr" ? "Ensemble (brut)" : "Ensemble (raw)", m?.ensemble_raw?.log_loss, m?.ensemble_raw?.rps],
    [locale === "fr" ? "Ensemble (calibré)" : "Ensemble (calibrated)", m?.ensemble_cal?.log_loss, m?.ensemble_cal?.rps],
  ];

  const limitations = locale === "fr"
    ? [
        "Le football est très variable. Un « bon » classificateur sur cette tâche tourne autour de 0.88-0.95 log-loss ; la calibration est l'objectif, pas la certitude.",
        "Les signaux à l'échelle de l'effectif (blessures, changements d'entraîneur, choix tactiques) ne sont pas modélisés — seuls les résultats des sélections nationales le sont.",
        "L'avantage du terrain ne s'applique qu'aux USA / Mexique / Canada à domicile ; tous les autres matchs sont traités comme neutres.",
        "Le mapping R32 reflète le format 2026 publié ; de petites différences d'assignation des places ont un effet négligeable sur les probabilités agrégées.",
        "Pré-tournoi uniquement : ce site ne se met pas à jour avec les vrais résultats pendant le tournoi.",
      ]
    : [
        "Football is high-variance. A 'good' classifier on this task lands near 0.88-0.95 log-loss; calibration is the point, not certainty.",
        "Squad-level signals (injuries, manager changes, tactical fit) are not modeled — only national-team match results.",
        "Host advantage applies only to USA / Mexico / Canada in their home matches; all other fixtures are treated as neutral venues.",
        "The R32 bracket-mapping mirrors the published 2026 format; small differences in slot assignment have negligible effect on aggregate probabilities.",
        "Pre-tournament only: this site does not update mid-tournament with actual results.",
      ];

  return (
    <>
      <Section title={t("methodology.title")} description={t("methodology.desc")}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PHASES.map(({ title, icon: Icon, body }) => (
            <div key={title} className="glass p-5">
              <Icon className="h-5 w-5 text-accent-green" />
              <div className="mt-3 font-semibold">{title}</div>
              <p className="mt-1 text-sm text-white/60 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("methodology.metrics")} description={t("methodology.metricsDesc", { window: meta.test_window })}>
        <div className="glass p-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-white/40 border-b border-white/5">
                <th className="py-2 font-medium">{locale === "fr" ? "Modèle" : "Model"}</th>
                <th className="py-2 font-medium text-right">Log-loss</th>
                <th className="py-2 font-medium text-right">RPS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([name, ll, rps]) => (
                <tr key={name as string} className="border-b border-white/5 last:border-0">
                  <td className="py-2.5">{name}</td>
                  <td className="py-2.5 text-right numeric">{typeof ll === "number" ? ll.toFixed(4) : "—"}</td>
                  <td className="py-2.5 text-right numeric">{typeof rps === "number" ? rps.toFixed(4) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 text-xs text-white/40">
            {locale === "fr"
              ? "Plus bas est meilleur. Le RPS (Ranked Probability Score) est la métrique standard pour les sorties ordinales à 3 classes."
              : "Lower is better. RPS (Ranked Probability Score) is the standard metric for 3-class ordered outcomes."}
          </div>
        </div>
      </Section>

      <Section title={t("methodology.reliability")} description={t("methodology.reliabilityDesc")}>
        <div className="glass p-5 inline-block">
          <CalibrationImage />
          <p className="text-xs text-white/40 mt-2 max-w-md">
            {locale === "fr"
              ? "Diagramme de fiabilité depuis l'ensemble test. Courbe proche de la diagonale = bien calibré."
              : "Reliability diagram from the held-out test set. Curve close to the diagonal = well-calibrated."}
          </p>
        </div>
      </Section>

      <Section title={t("methodology.limitations")} description={t("methodology.limitationsDesc")}>
        <div className="glass p-5">
          <ul className="space-y-2 text-sm text-white/70 list-disc list-inside">
            {limitations.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </div>
      </Section>

      <Section title={t("methodology.reproduce")}>
        <div className="glass p-5 text-sm">
          <p className="text-white/70">
            {locale === "fr"
              ? "Tout le pipeline tient dans un seul notebook Jupyter. Pour reproduire :"
              : "The entire pipeline lives in a single Jupyter notebook. To reproduce:"}
          </p>
          <ol className="mt-3 space-y-1.5 text-white/60 list-decimal list-inside">
            <li>{locale === "fr" ? "Placez votre token API Kaggle dans" : "Drop your Kaggle API token at"} <code className="text-white">%USERPROFILE%/.kaggle/kaggle.json</code></li>
            <li>{locale === "fr" ? "Installez les dépendances :" : "Install dependencies:"} <code className="text-white">pip install -r requirements.txt</code></li>
            <li>{locale === "fr" ? "Ouvrez" : "Open"} <code className="text-white">notebook/wc2026_pipeline.ipynb</code> {locale === "fr" ? "et Restart & Run All" : "and Restart & Run All"}</li>
            <li>{locale === "fr" ? "Les artefacts JSON atterrissent dans" : "JSON artifacts land in"} <code className="text-white">web/public/data/</code></li>
            <li>{locale === "fr" ? "Lancez" : "Run"} <code className="text-white">npm run dev</code> {locale === "fr" ? "dans" : "in"} <code className="text-white">web/</code></li>
          </ol>
        </div>
      </Section>
    </>
  );
}
