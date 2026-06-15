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
        { title: "Préparation des données", icon: Layers, body: "Époque moderne (1993+), Elo, forces attaque/défense mises à jour en ligne, forme 5/10 matchs, repos, congestion et fraîcheur du classement FIFA — tout calculé avant le coup d'envoi, sans fuite de données." },
        { title: "Modélisation", icon: Cpu, body: "Une validation glissante choisit entre XGBoost et une régression multinomiale régularisée. Le gagnant est combiné à un modèle de buts Poisson ajusté Dixon-Coles, puis calibré par température." },
        { title: "Évaluation", icon: Gauge, body: "Trois fenêtres de validation chronologique (2018-23) règlent le modèle. La période 2024+ reste totalement séparée pour le score final et l'ensemble y bat la baseline Elo." },
        { title: "Déploiement", icon: GitBranch, body: "Les scénarios effectif, vide tactique, fatigue, chaleur et voyage modifient les buts attendus sans entrer dans l'entraînement. Une porte qualité valide les artefacts, les tests et le build avant publication." },
      ]
    : [
        { title: "Business understanding", icon: Sparkles, body: "Calibrated probabilities for every WC 2026 match and tournament-level outcomes via Monte Carlo. Success is measured against an Elo-only baseline on log-loss, Brier, and Ranked Probability Score (RPS)." },
        { title: "Data understanding", icon: Database, body: "Two Kaggle datasets — `martj42/international-football-results-from-1872-to-2017` (~48k matches) and `cashncarry/fifaworldranking` — joined to a hand-curated 2026 team + group file." },
        { title: "Data preparation", icon: Layers, body: "Modern era (1993+), Elo, online attack/defence strengths, 5/10-match form, rest, congestion, and FIFA-ranking freshness — every value is computed before kickoff with leakage protection." },
        { title: "Modeling", icon: Cpu, body: "Walk-forward validation chooses between XGBoost and regularized multinomial regression. The winner is blended with a Dixon-Coles-adjusted Poisson goals model, then temperature-scaled." },
        { title: "Evaluation", icon: Gauge, body: "Three chronological validation windows (2018-23) tune and select the model. The 2024+ period stays untouched for the final scorecard, where the ensemble beats Elo-only." },
        { title: "Deployment", icon: GitBranch, body: "Squad, tactical-void, fatigue, heat, and travel scenarios adjust expected goals without entering training. A release gate validates artifacts, tests, and the production build before publication." },
      ];

  const rows = [
    [locale === "fr" ? "Baseline Elo seul" : "Elo-only baseline", m?.elo_baseline?.log_loss, m?.elo_baseline?.rps],
    [locale === "fr" ? "Classificateur XGBoost" : "XGBoost classifier", m?.xgb_only?.log_loss, m?.xgb_only?.rps],
    [locale === "fr" ? "Classificateur sélectionné" : "Selected classifier", m?.selected_classifier?.log_loss, m?.selected_classifier?.rps],
    [locale === "fr" ? "Buts Poisson → V/N/D" : "Poisson goals → W/D/L", m?.poisson_only?.log_loss, m?.poisson_only?.rps],
    [locale === "fr" ? "Ensemble (brut)" : "Ensemble (raw)", m?.ensemble_raw?.log_loss, m?.ensemble_raw?.rps],
    [locale === "fr" ? "Ensemble (calibré)" : "Ensemble (calibrated)", m?.ensemble_cal?.log_loss, m?.ensemble_cal?.rps],
  ];

  const limitations = locale === "fr"
    ? [
        "Le football est très variable. Un « bon » classificateur sur cette tâche tourne autour de 0.88-0.95 log-loss ; la calibration est l'objectif, pas la certitude.",
        "Les scénarios d'effectif et tactiques sont des tests de sensibilité déclarés par l'utilisateur, pas des blessures vérifiées ni des coefficients appris sur un historique médical complet.",
        "L'avantage du terrain ne s'applique qu'aux USA / Mexique / Canada à domicile ; tous les autres matchs sont traités comme neutres.",
        "Le mapping R32 reflète le format 2026 publié ; de petites différences d'assignation des places ont un effet négligeable sur les probabilités agrégées.",
        "Les résultats terminés sont récupérés automatiquement puis le modèle est réentraîné ; une source externe en retard peut retarder une mise à jour.",
      ]
    : [
        "Football is high-variance. A 'good' classifier on this task lands near 0.88-0.95 log-loss; calibration is the point, not certainty.",
        "Squad and tactical scenarios are user-declared sensitivity tests, not verified injury reports or coefficients learned from complete historical medical data.",
        "Host advantage applies only to USA / Mexico / Canada in their home matches; all other fixtures are treated as neutral venues.",
        "The R32 bracket-mapping mirrors the published 2026 format; small differences in slot assignment have negligible effect on aggregate probabilities.",
        "Completed results are fetched automatically and trigger a full retrain; an upstream data delay can postpone an update.",
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
