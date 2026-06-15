"""Validate prediction artifacts and write a timestamped release manifest."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
WEB_DATA = ROOT / "web" / "public" / "data"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate() -> dict:
    teams = load_json(ARTIFACTS / "teams.json")
    schedule = load_json(ARTIFACTS / "schedule.json")
    pairwise = load_json(ARTIFACTS / "pairwise.json")
    meta = load_json(ARTIFACTS / "meta.json")

    assert len(teams) == 48, f"Expected 48 teams, found {len(teams)}"
    assert len({team["code"] for team in teams}) == 48, "Duplicate team codes"
    groups = {}
    for team in teams:
        groups.setdefault(team["group"], []).append(team["code"])
    assert set(groups) == set("ABCDEFGHIJKL"), "Groups must be A-L"
    assert all(len(members) == 4 for members in groups.values()), "Each group must have four teams"

    assert len(schedule) == 104, f"Expected 104 matches, found {len(schedule)}"
    assert len({match["id"] for match in schedule}) == 104, "Duplicate match IDs"

    expected_pairs = 48 * 47
    assert len(pairwise) == expected_pairs, (
        f"Expected {expected_pairs} ordered pairs, found {len(pairwise)}"
    )
    for key, pair in pairwise.items():
        probability_sum = pair["pH"] + pair["pD"] + pair["pA"]
        assert abs(probability_sum - 1.0) <= 0.0015, (
            f"{key} probabilities sum to {probability_sum}"
        )
        assert 0.05 <= pair["lh"] <= 6.0, f"{key} home lambda out of range"
        assert 0.05 <= pair["la"] <= 6.0, f"{key} away lambda out of range"

    metrics = meta["test_metrics"]
    assert metrics["ensemble_cal"]["log_loss"] <= metrics["elo_baseline"]["log_loss"], (
        "Calibrated ensemble no longer beats the frozen Elo benchmark"
    )
    assert meta.get("walk_forward_cv", {}).get("mean_log_loss"), (
        "Missing walk-forward validation metrics"
    )
    assert meta.get("feature_policy", {}).get("pre_match_only") is True, (
        "Release is not marked as pre-match-only"
    )

    tracked_files = ["teams.json", "schedule.json", "pairwise.json", "meta.json"]
    return {
        "version": meta["version"],
        "trained_at": meta["trained_at"],
        "validated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "latest_result_date": meta.get("latest_result_date"),
        "quality_gates": {
            "team_and_group_integrity": "passed",
            "schedule_integrity": "passed",
            "probability_integrity": "passed",
            "walk_forward_metrics_present": "passed",
            "elo_benchmark": "passed",
            "pre_match_feature_policy": "passed",
        },
        "files": {
            name: {"sha256": sha256(ARTIFACTS / name)}
            for name in tracked_files
        },
    }


def main() -> None:
    manifest = validate()
    payload = json.dumps(manifest, indent=2) + "\n"
    (ARTIFACTS / "release_manifest.json").write_text(payload, encoding="utf-8")
    (WEB_DATA / "release_manifest.json").write_text(payload, encoding="utf-8")
    print(
        f"Release {manifest['version']} passed all quality gates "
        f"through {manifest['latest_result_date']}."
    )


if __name__ == "__main__":
    main()
