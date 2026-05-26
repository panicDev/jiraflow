"""Unit test: scripts/review_log/redact.py

execution:
    python -m unittest discover tests/review_log
    (Run from repo root. sys.path must include scripts/ directory)
"""

import sys
import os
import unittest

# Add scripts/ directory to sys.path (secure package import path)
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_SCRIPTS_DIR = os.path.join(_REPO_ROOT, "scripts")
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

from review_log.redact import redact, REDACT_PATTERNS  # noqa: E402


class TestRedactPatterns(unittest.TestCase):
    """U1~U4, U7, U9: Individual pattern match verification."""

    def test_u1_aws_access_key(self):
        """U1: AWS Access Key has been redacted."""
        text = "AKIAIOSFODNN7EXAMPLE in config"
        result = redact(text)
        self.assertIn("***REDACTED:aws_access_key***", result)
        self.assertNotIn("AKIAIOSFODNN7EXAMPLE", result)

    def test_u2_jwt(self):
        """U2: JWT token is redacted."""
        text = "token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SIG_abc123"
        result = redact(text)
        self.assertIn("***REDACTED:jwt***", result)
        self.assertNotIn("eyJhbGciOiJIUzI1NiJ9", result)

    def test_u3_bearer(self):
        """U3: Bearer header is redacted."""
        text = "Authorization: Bearer abc123xyz"
        result = redact(text)
        self.assertIn("***REDACTED:bearer***", result)
        self.assertNotIn("abc123xyz", result)

    def test_u4_github_pat(self):
        """U4: GitHub PAT redacted (ghp_ prefix)."""
        text = "ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        result = redact(text)
        self.assertIn("***REDACTED:github_pat***", result)
        self.assertNotIn("ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", result)

    def test_u4_github_pat_variants(self):
        """U4 variant: gho_, ghs_, ghr_ prefixes are also redacted."""
        for prefix in ("gho_", "ghs_", "ghr_"):
            with self.subTest(prefix=prefix):
                token = prefix + "a" * 36
                result = redact(token)
                self.assertIn("***REDACTED:github_pat***", result)
                self.assertNotIn(token, result)

    def test_u7_multiple_patterns(self):
        """U7: If AWS key + JWT exist at the same time in the same text, both are redacted."""
        text = (
            "key=AKIAIOSFODNN7EXAMPLE "
            "jwt=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SIG_abc123"
        )
        result = redact(text)
        self.assertIn("***REDACTED:aws_access_key***", result)
        self.assertIn("***REDACTED:jwt***", result)
        self.assertNotIn("AKIAIOSFODNN7EXAMPLE", result)
        self.assertNotIn("eyJhbGciOiJIUzI1NiJ9", result)

    def test_u9_short_bearer_token(self):
        """U9: Short Bearer tokens (1 character) also match — avoid regression."""
        text = "Bearer x"
        result = redact(text)
        # The current regular expression is a 1+ length match, so it must be redacted
        self.assertIn("***REDACTED:bearer***", result)


class TestRedactEdgeCases(unittest.TestCase):
    """U5, U6: edge case verification."""

    def test_u5_none_input(self):
        """U5: Return as is when None is entered, no exception."""
        result = redact(None)
        self.assertIsNone(result)

    def test_u5_integer_input(self):
        """U5: When entering an integer, return as is, no exception."""
        result = redact(123)
        self.assertEqual(result, 123)

    def test_u6_empty_string(self):
        """U6: Returns an empty string when an empty string is input."""
        result = redact("")
        self.assertEqual(result, "")

    def test_u6_no_match(self):
        """U6: Plain text without sensitive information is returned without change."""
        text = "hello world"
        result = redact(text)
        self.assertEqual(result, text)


class TestRedactZeroLeak(unittest.TestCase):
    """U8: AC-3 — Verification of 0 leaks of sensitive information (zero-leak)."""

    # Composite string including all 6 types of sensitive information samples
    _SENSITIVE_TEXT = (
        "aws_key=AKIAIOSFODNN7EXAMPLE "
        "aws_secret_access_key='wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' "
        "jwt=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SIG_abc123 "
        "Authorization: Bearer mytoken.abc.xyz "
        "ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa "
        "api_key='supersecretpassword1234567'"
    )

    # Original sensitive value of each pattern (part that should not remain after redact)
    _SECRETS = [
        "AKIAIOSFODNN7EXAMPLE",
        "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        "eyJhbGciOiJIUzI1NiJ9",  # JWT header
        "mytoken.abc.xyz",
        "ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "supersecretpassword1234567",
    ]

    def test_u8_zero_leak(self):
        """U8: The redact result contains 0 original sensitive information."""
        result = redact(self._SENSITIVE_TEXT)
        for secret in self._SECRETS:
            with self.subTest(secret=secret[:20] + "..."):
                self.assertNotIn(
                    secret,
                    result,
                    msg=f"Sensitive information leak detected: '{secret[:20]}...' included in redact results",
                )

    def test_u8_redacted_labels_present(self):
        """U8 Secondary: redact result contains REDACTED label (check substitution action)."""
        result = redact(self._SENSITIVE_TEXT)
        self.assertIn("***REDACTED:", result)


class TestRedactPatternList(unittest.TestCase):
    """Verification of REDACT_PATTERNS structure — Must be enumerable in Story 3 analyze."""

    def test_patterns_is_list_of_tuples(self):
        """REDACT_PATTERNS must be a list of (label, compiled_pattern) tuples."""
        import re as re_module
        self.assertIsInstance(REDACT_PATTERNS, list)
        self.assertGreater(len(REDACT_PATTERNS), 0)
        for label, pattern in REDACT_PATTERNS:
            with self.subTest(label=label):
                self.assertIsInstance(label, str)
                self.assertIsInstance(pattern, re_module.Pattern)

    def test_expected_labels_present(self):
        """All 6 labels exist in REDACT_PATTERNS."""
        labels = {label for label, _ in REDACT_PATTERNS}
        expected = {
            "aws_access_key",
            "aws_secret_key",
            "jwt",
            "bearer",
            "github_pat",
            "generic_secret",
        }
        self.assertEqual(labels, expected)


if __name__ == "__main__":
    unittest.main()
