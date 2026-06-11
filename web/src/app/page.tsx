"use client";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Activity, FlaskConical } from "lucide-react";
import { Section } from "@/components/Section";
import StatTile from "@/components/StatTile";
import ChampionRace from "@/components/ChampionRace";
import TeamBadge from "@/components/TeamBadge";
import { teams, teamByCode, schedule, meta } from "@/lib/data";
import { useSimulation } from "@/lib/sim/useSimulation";
import { useT } from "@/lib/i18n/context";

const FIRST_MATCH_DATE = "2026-06-11T19:00:00-06:00";

export default function HomePage() {
  const { t, locale } = useT();
  const { status, result, elapsedMs, run } = useSimulation();

  useEffect(() => { run({ iterations: 10000, seed: 7 }); }, [run]);

  const top10 = useMemo(() => {
    if (!result) return [];
    return Object.entries(result.champion)
      .map(([code, p]) => ({ team: teamByCode[code], p }))
      .sort((a, b) => b.p - a.p)
      .slice(0, 10);
  }, [result]);

  const headline = useMemo(() => {
    if (!result) return null;
    const finalists = Object.entries(result.reachFinal).sort((a, b) => b[1] - a[1]);
    const champ = Object.entries(result.champion).sort((a, b) => b[1] - a[1])[0];
    const darkHorse = Object.entries(result.reachQF)
      .map(([c, p]) => ({ c, p, elo: teamByCode[c]?.elo ?? 0 }))
      .filter((x) => x.elo < 1900 && x.p > 0.2)
      .sort((a, b) => b.p - a.p)[0];
    return {
      mostLikelyFinal: finalists.slice(0, 2).map(([c]) => teamByCode[c]),
      champion: { team: teamByCode[champ[0]], p: champ[1] },
      darkHorse: darkHorse ? { team: teamByCode[darkHorse.c], p: darkHorse.p } : null,
    };
  }, [result]);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-grid-fade" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-12 sm:pt-20 pb-8 sm:pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-accent-green mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{t("home.eyebrow")}</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
              {t("home.heroLine1")}
              <br />
              <span className="bg-gradient-to-r from-accent-green via-accent-blue to-accent-gold bg-clip-text text-transparent">
                {t("home.heroLine2")}
              </span>
            </h1>
            <p className="mt-5 text-white/60 text-base sm:text-lg max-w-2xl leading-relaxed">
              {t("home.heroSub", { n: result?.iterations.toLocaleString() || "10,000" })}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/bracket"
                className="inline-flex items-center gap-2 rounded-full bg-accent-green text-ink-950 font-medium px-5 py-2.5 text-sm hover:shadow-glow transition-shadow"
              >
                {t("home.exploreBracket")} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/simulator"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-sm hover:bg-white/5"
              >
                <FlaskConical className="h-4 w-4" /> {t("home.openSimulator")}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Headline stats */}
      <Section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatTile label={t("home.teams")} value="48" sub={t("home.teamsSub")} />
          <StatTile label={t("home.matches")} value="104" sub={t("home.matchesSub", { date: new Date(FIRST_MATCH_DATE).toLocaleDateString(locale) })} />
          <StatTile
            label={t("home.modelLogLoss")}
            value={meta.test_metrics?.ensemble_cal?.log_loss?.toFixed(3) ?? "—"}
            sub={t("home.modelLogLossSub", { value: meta.test_metrics?.elo_baseline?.log_loss?.toFixed(3) ?? "—" })}
          />
          <StatTile
            label={t("home.simRuns")}
            value={result ? result.iterations.toLocaleString() : "…"}
            sub={result ? t("home.simRunsSub", { time: (elapsedMs / 1000).toFixed(2) }) : t("home.simRunsStarting")}
          />
        </div>
      </Section>

      {/* Champion race */}
      <Section title={t("home.championProb")} description={t("home.championProbSub")}>
        <div className="glass p-5 sm:p-7">
          {status === "loading" || status === "running" || !result ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-7 rounded-md bg-white/5" />
              ))}
            </div>
          ) : (
            <ChampionRace data={top10} />
          )}
        </div>
      </Section>

      {/* Headlines */}
      {headline && (
        <Section title={t("home.story")} description={t("home.storySub")}>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="glass p-5">
              <div className="text-xs uppercase tracking-widest text-white/40 mb-3">{t("home.mostLikelyChampion")}</div>
              <div className="flex items-center gap-3">
                <TeamBadge team={headline.champion.team} size="lg" />
                <div className="ml-auto numeric text-2xl font-semibold">
                  {(headline.champion.p * 100).toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="glass p-5">
              <div className="text-xs uppercase tracking-widest text-white/40 mb-3">{t("home.mostLikelyFinal")}</div>
              <div className="flex items-center gap-3">
                <TeamBadge team={headline.mostLikelyFinal[0]} size="md" />
                <span className="text-white/40 text-sm">vs</span>
                <TeamBadge team={headline.mostLikelyFinal[1]} size="md" />
              </div>
            </div>
            <div className="glass p-5">
              <div className="text-xs uppercase tracking-widest text-white/40 mb-3">{t("home.darkHorse")}</div>
              {headline.darkHorse && (
                <div className="flex items-center gap-3">
                  <TeamBadge team={headline.darkHorse.team} size="lg" />
                  <div className="ml-auto numeric text-2xl font-semibold text-accent-blue">
                    {(headline.darkHorse.p * 100).toFixed(0)}%
                  </div>
                </div>
              )}
              <div className="mt-1 text-xs text-white/40">{t("home.darkHorseSub")}</div>
            </div>
          </div>
        </Section>
      )}

      {/* Quick links */}
      <Section title={t("home.digDeeper")}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { href: "/groups", title: t("home.groupsTitle"), desc: t("home.groupsDesc"), icon: Activity },
            { href: "/bracket", title: t("home.bracketTitle"), desc: t("home.bracketDesc"), icon: ArrowRight },
            { href: "/versus", title: t("home.versusTitle"), desc: t("home.versusDesc"), icon: Sparkles },
            { href: "/simulator", title: t("home.simulatorTitle"), desc: t("home.simulatorDesc"), icon: FlaskConical },
          ].map((c) => (
            <Link key={c.href} href={c.href} className="glass p-5 hover:bg-white/5 transition-colors group">
              <c.icon className="h-5 w-5 text-accent-green" />
              <div className="mt-3 font-medium">{c.title}</div>
              <div className="text-sm text-white/50 mt-1">{c.desc}</div>
              <div className="mt-3 text-xs text-accent-green/80 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                {t("home.open")} <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-xs text-white/40">
          {t("home.working", { teams: teams.length, matches: schedule.length, version: meta.version })}
        </p>
      </Section>
    </>
  );
}
