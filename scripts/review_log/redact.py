"""redact: Sensitive information redact module.

Replace the part matching each pattern of REDACT_PATTERNS with ***REDACTED:<label>***.
Import and use in Story 2 (append) and Story 3 (analyze).

Usage:
    from review_log.redact import redact
    clean_text = redact(raw_text)
"""

import re

# List of (label, compiled_pattern) pairs.
# Order is important: place the more specific pattern first so that the generic_secret matches the previous pattern.
# Make sure it is applied only to the remaining part.
REDACT_PATTERNS = [
    (
        "aws_access_key",
        re.compile(r"AKIA[0-9A-Z]{16}"),
    ),
    (
        "aws_secret_key",
        re.compile(
            r'(?i)aws[_-]?secret[_-]?access[_-]?key["\'\s:=]+([A-Za-z0-9/+=]{40})'
        ),
    ),
    (
        "jwt",
        re.compile(
            r"eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"
        ),
    ),
    (
        "bearer",
        re.compile(r"(?i)bearer\s+[A-Za-z0-9._\-]+"),
    ),
    (
        "github_pat",
        re.compile(r"gh[pousr]_[A-Za-z0-9]{36,}"),
    ),
    (
        "generic_secret",
        re.compile(
            r'(?i)(?:api[_-]?key|secret|password|token)["\'\s:=]+["\']?([A-Za-z0-9+/=_\-]{16,})["\']?'
        ),
    ),
]


def redact(text):
    """Replace sensitive information patterns in REDACT_PATTERNS order.

    Args:
        text: String to be processed. If it is non-string, it is returned as is (TypeError does not occur).

    Returns:
        The replaced string. Non-string input is returned as input.
    """
    if not isinstance(text, str):
        return text

    result = text
    for label, pattern in REDACT_PATTERNS:
        result = pattern.sub(f"***REDACTED:{label}***", result)
    return result
