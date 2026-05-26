"""gen_review_log.py — 1000 cases _index.jsonl fixture creation script

Fix the random seed for reproducibility.

Usage:
    python tests/fixtures/gen_review_log.py
    python tests/fixtures/gen_review_log.py --count 1000 --output tests/fixtures/review-log-1000.jsonl
"""

import argparse
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

SEED = 42
OUTCOMES = ["pass", "fail", "warn"]
OUTCOME_WEIGHTS = [0.6, 0.25, 0.15]

SEVERITY_KEYS = ["critical", "high", "medium", "low", "info"]
# Average count by severity (Poisson distribution λ)
SEVERITY_LAMBDAS = {"critical": 0.1, "high": 1.5, "medium": 3.0, "low": 4.0, "info": 2.0}


def gen_entry(rng: random.Random, index: int) -> dict:
    # timestamp: Uniformly distributed in the range from 2025-01-01 to 2026-04-29
    base = datetime(2025, 1, 1, tzinfo=timezone.utc)
    offset_days = rng.randint(0, 483) # About 16 months
    offset_secs = rng.randint(0, 86399)
    ts = base + timedelta(days=offset_days, seconds=offset_secs)

    outcome = rng.choices(OUTCOMES, weights=OUTCOME_WEIGHTS, k=1)[0]

    severity_counts = {}
    for sev in SEVERITY_KEYS:
        lam = SEVERITY_LAMBDAS[sev]
        # Simple Poisson approximation: integer samples of average lam
        count = max(0, int(rng.gauss(lam, lam ** 0.5)))
        severity_counts[sev] = count

    return {
        "taskId": f"MAE-{200 + (index % 50)}",
        "timestamp": ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "outcome": outcome,
        "severityCounts": severity_counts,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Create review-log fixture")
    parser.add_argument("--count", type=int, default=1000, help="Number of entries to create (default: 1000)")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent / "review-log-1000.jsonl",
        help="Output file path",
    )
    args = parser.parse_args()

    rng = random.Random(SEED)
    args.output.parent.mkdir(parents=True, exist_ok=True)

    with open(args.output, "w", encoding="utf-8", newline="\n") as fh:
        for i in range(args.count):
            entry = gen_entry(rng, i)
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")

    print(f"Created: {args.output} ({args.count} items)")


if __name__ == "__main__":
    main()
