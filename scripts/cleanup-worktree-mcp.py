#!/usr/bin/env python3
"""cleanup-worktree-mcp.py — jira-task-done Step 7

Remove `mcpServers` key from `~/.claude.json`'s `projects[<worktreePath>]` entry.
Preserves the entry itself and all other metadata.

Usage:
    python3 scripts/cleanup-worktree-mcp.py <worktreePath>

Behavior:
    - If there is no path or matching entry, only a message is output and exit (not an error).
    - When matching, remove only the mcpServers key and save the file.
"""
import json
import os
import sys


def norm(p: str) -> str:
    return p.replace("\\", "/").rstrip("/")


def main() -> int:
    if len(sys.argv) < 2 or not sys.argv[1]:
        print("usage: cleanup-worktree-mcp.py <worktreePath>", file=sys.stderr)
        return 2

    worktree_path = sys.argv[1]
    claude_json_path = os.path.expanduser("~/.claude.json")

    with open(claude_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    wt = norm(worktree_path)
    projects = data.get("projects", {})

    matched_key = None
    for k in list(projects.keys()):
        if norm(k) == wt:
            matched_key = k
            break

    if matched_key and isinstance(projects[matched_key], dict):
        projects[matched_key].pop("mcpServers", None)
        with open(claude_json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"MCP config removed from {wt}")
    else:
        print(f"No entry found for {wt}, skipping")

    return 0


if __name__ == "__main__":
    sys.exit(main())
