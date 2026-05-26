"""analyze-review-log.py — Cumulative review log statistical analysis script

It takes _index.jsonl as input and outputs cumulative review statistics.
No external dependencies (Python standard library only).

## Example usage

# Default execution (_index.jsonl in current directory)
    python scripts/analyze-review-log.py

# Specify input file
    python scripts/analyze-review-log.py --input docs/review-log/_index.jsonl

# Count only after a specific date + Top 5 categories
    python scripts/analyze-review-log.py --input docs/review-log/_index.jsonl --since 2026-01-01 --top 5

## Options

    --input PATH Input JSONL file path (default: _index.jsonl)
    --top N outcome/severity Output top N outcomes (default: 10)
    --since DATE Start date relative to UTC in YYYY-MM-DD format (inclusive only after midnight UTC on this date)

## Output items

    1. Cumulative number of reviews
    2. Finding distribution by severity (sum of severityCounts)
    3. Outcome frequency (pass/fail/warn)
    4. FP rate (current stage: 0.0% — automatically reflected when schema is expanded)

## Caution

    --since The comparison standard is UTC. It may differ from your local time zone.
    Corrupted lines (JSON parsing failure, missing required fields) are skipped after warning on stderr.
"""

import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, NamedTuple


# ---------------------------------------------------------------------------
# Data container
# ---------------------------------------------------------------------------

class AggregateResult(NamedTuple):
    cumulative_review_count: int
    severity_dist: Counter
    outcome_freq: Counter
    findings_total: int
    fp_total: int
    skipped: int


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

def parse_since(s: str) -> datetime:
    """Convert YYYY-MM-DD string to UTC midnight aware datetime."""
    try:
        d = datetime.strptime(s, "%Y-%m-%d")
    except ValueError:
        raise argparse.ArgumentTypeError(
            f"The date format is incorrect: '{s}'. Use YYYY-MM-DD (UTC) format."
        )
    return d.replace(tzinfo=timezone.utc)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="analyze-review-log",
        description="_index.jsonl Cumulative review statistical analysis (using standard library only)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Example:\n"
            "  python scripts/analyze-review-log.py\n"
            "  python scripts/analyze-review-log.py --input docs/review-log/_index.jsonl\n"
            "  python scripts/analyze-review-log.py --since 2026-01-01 --top 5\n"
            "\n"
            "Note: --since comparison is in UTC."
        ),
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("_index.jsonl"),
        metavar="PATH",
        help="Input JSONL file path (default: _index.jsonl)",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=10,
        metavar="N",
        help="severity/outcome Output top N (default: 10)",
    )
    parser.add_argument(
        "--since",
        type=parse_since,
        default=None,
        metavar="YYYY-MM-DD",
        help="UTC-relative start date (only include entries after midnight UTC on this date)",
    )
    return parser


# ---------------------------------------------------------------------------
# Entry iteration
# ---------------------------------------------------------------------------

def _parse_timestamp(ts_str: str) -> datetime:
    """Convert ISO8601 string to UTC aware datetime.

    If timezone information is missing, assume UTC (MAE-179 schema policy).
    """
    # Python 3.7+: replace datetime.fromisoformat as it does not support 'Z' suffix
    normalized = ts_str.replace("Z", "+00:00")
    dt = datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def iter_entries(path: Path, skipped_out: list) -> Iterator[dict]:
    """Yields a valid entry from the JSONL file.

    Corrupted lines print a warning to stderr and are skipped.
    Accumulate the number of skipped lines in skipped_out[0].
    """
    try:
        fh = open(path, encoding="utf-8", newline="")
    except FileNotFoundError:
        print(f"Error: File not found: {path}", file=sys.stderr)
        sys.exit(2)
    except OSError as exc:
        print(f"Error: Cannot open file: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        for lineno, line in enumerate(fh, start=1):
            line = line.rstrip("\r\n")
            if not line:
                continue # skip blank line (no warning)

            # JSON parsing
            try:
                entry = json.loads(line)
            except json.JSONDecodeError as exc:
                print(f"[warn] line {lineno}: invalid JSON — {exc.msg}", file=sys.stderr)
                skipped_out[0] += 1
                continue

            # Required field validation: timestamp
            if "timestamp" not in entry:
                print(f"[warn] line {lineno}: missing required field 'timestamp'", file=sys.stderr)
                skipped_out[0] += 1
                continue

            # Verify whether timestamp can be parsed
            try:
                _parse_timestamp(entry["timestamp"])
            except (ValueError, TypeError) as exc:
                print(f"[warn] line {lineno}: invalid timestamp '{entry.get('timestamp')}' — {exc}", file=sys.stderr)
                skipped_out[0] += 1
                continue

            yield entry
    finally:
        fh.close()


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------

def aggregate(
    entries: Iterator[dict],
    since: datetime | None,
) -> AggregateResult:
    """1-pass aggregation.

    _index.jsonl schema (MAE-179):
      taskId, timestamp, outcome, severityCounts{critical,high,medium,low,info}

    The severity distribution sums the severityCounts values.
    The FP rate is always 0.0% at the current stage (falsePositive is not included in the schema).
    """
    cumulative = 0
    severity_dist: Counter = Counter()
    outcome_freq: Counter = Counter()
    findings_total = 0
    fp_total = 0

    SEVERITY_KEYS = ("critical", "high", "medium", "low", "info")

    for entry in entries:
        # --since filter (UTC comparison)
        if since is not None:
            try:
                ts = _parse_timestamp(entry["timestamp"])
            except (ValueError, TypeError):
                # Already verified in iter_entries, so it doesn't reach here
                continue
            if ts < since:
                continue

        cumulative += 1

        # Outcome tally
        outcome = entry.get("outcome", "unknown")
        if not isinstance(outcome, str):
            outcome = "unknown"
        outcome_freq[outcome] += 1

        # severityCounts aggregate
        sc = entry.get("severityCounts")
        if isinstance(sc, dict):
            for key in SEVERITY_KEYS:
                val = sc.get(key, 0)
                if isinstance(val, int) and val > 0:
                    severity_dist[key] += val
                    findings_total += val
        # When severityCounts is missing/nondicted: Only reflected in count without severity aggregation

        # FP aggregation (no falsePositive in current stage schema → always 0)
        fp = entry.get("falsePositive")
        if fp is True:
            fp_total += 1

    return AggregateResult(
        cumulative_review_count=cumulative,
        severity_dist=severity_dist,
        outcome_freq=outcome_freq,
        findings_total=findings_total,
        fp_total=fp_total,
        skipped=0, # skipped is injected from outside (skipped_out of iter_entries)
    )


# ---------------------------------------------------------------------------
# Report formatting
# ---------------------------------------------------------------------------

def format_report(result: AggregateResult, top: int, skipped: int) -> str:
    lines = []
    lines.append("=" * 50)
    lines.append(" Review Log Cumulative Statistical Analysis")
    lines.append("=" * 50)

    # 1. Cumulative number of reviews
    lines.append(f"\n[1] Cumulative Review Count: {result.cumulative_review_count}")

    # 2. Finding distribution by severity
    lines.append("\n[2] Finding Distribution by Severity")
    SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"]
    if result.severity_dist:
        total = sum(result.severity_dist.values())
        for sev in SEVERITY_ORDER:
            count = result.severity_dist.get(sev, 0)
            pct = count / total * 100 if total > 0 else 0.0
            lines.append(f" {sev:<10}: {count:>6} cases ({pct:5.1f}%)")
        # severity not in SEVERITY_ORDER ("unknown", etc.)
        for sev, count in result.severity_dist.most_common():
            if sev not in SEVERITY_ORDER:
                pct = count / total * 100 if total > 0 else 0.0
                lines.append(f" {sev:<10}: {count:>6} cases ({pct:5.1f}%)")
    else:
        lines.append(" (no finding)")

    # 3. Outcome frequency (Top N)
    lines.append(f"\n[3] Outcome frequency (top {top})")
    if result.outcome_freq:
        for outcome, count in result.outcome_freq.most_common(top):
            lines.append(f" {outcome:<10}: {count:>6} cases")
    else:
        lines.append(" (no outcome)")

    # 4. FP Ratio
    lines.append("\n[4] False Positive Rate")
    if result.findings_total > 0:
        fp_rate = result.fp_total / result.findings_total * 100
        lines.append(
            f"    {fp_rate:.1f}%  ({result.fp_total}/{result.findings_total} findings)"
        )
    else:
        lines.append("    0.0%  (0/0 findings)")

    # Footer
    lines.append("\n" + "-" * 50)
    if skipped > 0:
        lines.append(f" skipped: {skipped} (corrupted lines, check for stderr warnings)")
    else:
        lines.append(" skipped: 0 items")
    lines.append("=" * 50)

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(argv: list | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    # --top validation
    if args.top <= 0:
        parser.error(f"--top value must be greater than or equal to 1: {args.top}")

    # Check file existence
    if not args.input.exists():
        parser.error(f"Input file not found: {args.input}")

    skipped_out = [0]
    entries = iter_entries(args.input, skipped_out)
    result = aggregate(entries, since=args.since)

    # Reflect the skipped number in the result (since it is a NamedTuple, use _replace)
    result = result._replace(skipped=skipped_out[0])

    report = format_report(result, top=args.top, skipped=skipped_out[0])
    print(report)

    return 0


if __name__ == "__main__":
    sys.exit(main())
