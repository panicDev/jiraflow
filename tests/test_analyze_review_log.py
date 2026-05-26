"""tests/test_analyze_review_log.py — analyze-review-log.py unit tests

Run: python -m unittest tests.test_analyze_review_log
Or: python -m unittest discover tests
"""

import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from datetime import datetime, timezone
from unittest.mock import patch

# Add script path to sys.path (scripts/ directory)
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import importlib.util
spec = importlib.util.spec_from_file_location(
    "analyze_review_log",
    REPO_ROOT / "scripts" / "analyze-review-log.py",
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

build_parser = module.build_parser
parse_since = module.parse_since
iter_entries = module.iter_entries
aggregate = module.aggregate
format_report = module.format_report
main = module.main
AggregateResult = module.AggregateResult


def make_entry(
    task_id="MAE-001",
    timestamp="2026-04-01T00:00:00Z",
    outcome="pass",
    severity_counts=None,
    **extra,
):
    entry = {
        "taskId": task_id,
        "timestamp": timestamp,
        "outcome": outcome,
        "severityCounts": severity_counts or {"critical": 0, "high": 1, "medium": 0, "low": 0, "info": 0},
    }
    entry.update(extra)
    return entry


def write_jsonl(path: Path, entries: list) -> None:
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        for e in entries:
            fh.write(json.dumps(e) + "\n")


class TestU1NormalAggregation(unittest.TestCase):
    """U1: Total of 5 normal entries"""

    def test_cumulative_and_severity(self):
        entries = [
            make_entry(severity_counts={"critical": 1, "high": 2, "medium": 0, "low": 0, "info": 0}),
            make_entry(severity_counts={"critical": 0, "high": 0, "medium": 3, "low": 1, "info": 0}),
            make_entry(outcome="fail", severity_counts={"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 2}),
            make_entry(outcome="warn", severity_counts={"critical": 0, "high": 1, "medium": 0, "low": 0, "info": 0}),
            make_entry(severity_counts={"critical": 0, "high": 0, "medium": 0, "low": 2, "info": 0}),
        ]
        result = aggregate(iter(entries), since=None)
        self.assertEqual(result.cumulative_review_count, 5)
        self.assertEqual(result.severity_dist["critical"], 1)
        self.assertEqual(result.severity_dist["high"], 3)
        self.assertEqual(result.severity_dist["medium"], 3)
        self.assertEqual(result.severity_dist["low"], 3)
        self.assertEqual(result.severity_dist["info"], 2)
        self.assertEqual(result.outcome_freq["pass"], 3)
        self.assertEqual(result.outcome_freq["fail"], 1)
        self.assertEqual(result.outcome_freq["warn"], 1)


class TestU2CorruptLineSkip(unittest.TestCase):
    """U2: Damage line skip + warn"""

    def test_invalid_json_lines_skipped(self):
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".jsonl", delete=False, encoding="utf-8"
        ) as fh:
            fh.write(json.dumps(make_entry()) + "\n")
            fh.write("this is not json\n")
            fh.write(json.dumps(make_entry()) + "\n")
            fh.write("{broken json\n")
            fh.write(json.dumps(make_entry()) + "\n")
            tmp_path = Path(fh.name)

        skipped_out = [0]
        stderr_capture = io.StringIO()
        with patch("sys.stderr", stderr_capture):
            entries_list = list(iter_entries(tmp_path, skipped_out))

        tmp_path.unlink()

        self.assertEqual(len(entries_list), 3)
        self.assertEqual(skipped_out[0], 2)

        stderr_output = stderr_capture.getvalue()
        self.assertIn("[warn]", stderr_output)
        self.assertIn("line 2", stderr_output)
        self.assertIn("line 4", stderr_output)


class TestU3SinceUTCFilter(unittest.TestCase):
    """U3: --since UTC boundary filter"""

    def test_since_boundary(self):
        since = datetime(2026, 1, 1, tzinfo=timezone.utc)
        entries = [
            make_entry(timestamp="2025-12-31T23:59:59Z"), # except
            make_entry(timestamp="2026-01-01T00:00:00Z"), # include (with border)
            make_entry(timestamp="2026-01-01T00:00:01Z"), # include
            make_entry(timestamp="2026-06-15T12:00:00Z"), # Include
        ]
        result = aggregate(iter(entries), since=since)
        self.assertEqual(result.cumulative_review_count, 3)


class TestU4SinceFormatError(unittest.TestCase):
    """U4: --since format error → argparse SystemExit code 2"""

    def test_invalid_since_format(self):
        with self.assertRaises(SystemExit) as ctx:
            main(["--since", "2026/01/01", "--input", "_index.jsonl"])
        self.assertEqual(ctx.exception.code, 2)


class TestU5TopN(unittest.TestCase):
    """U5: Apply --top N"""

    def test_top_n_limits_outcome_output(self):
        entries = [
            make_entry(outcome="pass"),
            make_entry(outcome="fail"),
            make_entry(outcome="warn"),
            make_entry(outcome="pass"),
            make_entry(outcome="pass"),
        ]
        result = aggregate(iter(entries), since=None)
        report = format_report(result, top=2, skipped=0)
        # "Top 2" shown in header
        self.assertIn("2", report)
        # There are pass(3), fail(1), and warn(1) in outcome_freq, but if top=2, only pass and fail are displayed
        lines = report.split("\n")
        outcome_lines = [l for l in lines if "pass" in l or "fail" in l or "warn" in l]
        # If most_common(2), maximum 2 lines
        # format_report reflects the top limit so there should be no warn
        # (pass=3, fail=1 are the top 2 → warn=1 is the 3rd, so excluded)
        # However, "warn" must not be in the header or anywhere else
        outcome_section_lines = [l for l in lines if "warn" in l]
        self.assertEqual(len(outcome_section_lines), 0)


class TestU6EmptyFindings(unittest.TestCase):
    """U6: findings empty entry — +1 for cumulative count, finding count is 0"""

    def test_empty_severity_counts(self):
        entries = [
            make_entry(severity_counts={"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}),
        ]
        result = aggregate(iter(entries), since=None)
        self.assertEqual(result.cumulative_review_count, 1)
        self.assertEqual(result.findings_total, 0)
        self.assertEqual(sum(result.severity_dist.values()), 0)


class TestU7FPRatio(unittest.TestCase):
    """U7: Calculate FP rate (using falsePositive field)"""

    def test_fp_ratio(self):
        # In the current schema, falsePositive is an entry level field (undefined)
        # The script processes fp_total++ when `entry.get("falsePositive") is True`
        entries = [
            make_entry(
                severity_counts={"critical": 0, "high": 2, "medium": 1, "low": 1, "info": 0},
                falsePositive=True,
            ),
            make_entry(
                severity_counts={"critical": 0, "high": 1, "medium": 0, "low": 0, "info": 0},
            ),
        ]
        result = aggregate(iter(entries), since=None)
        self.assertEqual(result.fp_total, 1)
        self.assertEqual(result.findings_total, 5)

        report = format_report(result, top=10, skipped=0)
        self.assertIn("20.0%", report)
        self.assertIn("(1/5", report)


class TestU8EmptyFile(unittest.TestCase):
    """U8: Empty file → exit 0, count=0"""

    def test_empty_file(self):
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".jsonl", delete=False, encoding="utf-8"
        ) as fh:
            tmp_path = Path(fh.name)

        try:
            exit_code = main(["--input", str(tmp_path)])
        finally:
            tmp_path.unlink()

        self.assertEqual(exit_code, 0)

    def test_empty_aggregate(self):
        result = aggregate(iter([]), since=None)
        self.assertEqual(result.cumulative_review_count, 0)
        self.assertEqual(result.findings_total, 0)


class TestU9UnknownSeverity(unittest.TestCase):
    """U9: 0 count when severity/category is absent (severityCounts missing entry)"""

    def test_missing_severity_counts(self):
        entries = [
            {
                "taskId": "MAE-001",
                "timestamp": "2026-04-01T00:00:00Z",
                "outcome": "pass",
                # severityCounts none
            },
        ]
        result = aggregate(iter(entries), since=None)
        # Reflected in cumulative
        self.assertEqual(result.cumulative_review_count, 1)
        # severity_dist is empty
        self.assertEqual(sum(result.severity_dist.values()), 0)


class TestU10NaiveTimestamp(unittest.TestCase):
    """U10: Timestamp without timezone → Normal comparison --since considered as UTC"""

    def test_naive_timestamp_treated_as_utc(self):
        since = datetime(2026, 4, 1, tzinfo=timezone.utc)
        entries = [
            # naive timestamp without timezone — should be assumed to be UTC
            make_entry(timestamp="2026-04-01T00:00:00"), # Include
            make_entry(timestamp="2026-03-31T23:59:59"), # except
        ]
        result = aggregate(iter(entries), since=since)
        self.assertEqual(result.cumulative_review_count, 1)


class TestParseSince(unittest.TestCase):
    """parse_since function unit test"""

    def test_valid_date(self):
        dt = parse_since("2026-01-15")
        self.assertEqual(dt.year, 2026)
        self.assertEqual(dt.month, 1)
        self.assertEqual(dt.day, 15)
        self.assertEqual(dt.tzinfo, timezone.utc)

    def test_invalid_format_raises(self):
        with self.assertRaises(argparse.ArgumentTypeError):
            parse_since("2026/01/15")


class TestMissingTimestampSkipped(unittest.TestCase):
    """Skip + warn for lines with missing timestamp field"""

    def test_missing_timestamp(self):
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".jsonl", delete=False, encoding="utf-8"
        ) as fh:
            fh.write(json.dumps({"taskId": "MAE-001", "outcome": "pass"}) + "\n") # No timestamp
            fh.write(json.dumps(make_entry()) + "\n")
            tmp_path = Path(fh.name)

        skipped_out = [0]
        stderr_capture = io.StringIO()
        with patch("sys.stderr", stderr_capture):
            entries_list = list(iter_entries(tmp_path, skipped_out))

        tmp_path.unlink()

        self.assertEqual(len(entries_list), 1)
        self.assertEqual(skipped_out[0], 1)
        self.assertIn("missing required field 'timestamp'", stderr_capture.getvalue())


import argparse # noqa: E402 (reference within module if necessary)

if __name__ == "__main__":
    unittest.main()
