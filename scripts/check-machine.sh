#!/usr/bin/env bash
# Machine check for the Registry Insight workshop (macOS and Linux).
# Confirms Claude Code, OpenCode, Node, and DuckDB.
# Confirms OPENROUTER_API_KEY is set without printing it.
# Confirms ANTHROPIC_API_KEY is empty.
#
#   bash scripts/check-machine.sh

cd "$(dirname "$0")/.."

problems=0

ok() { printf 'OK   | %s\n' "$1"; }
warn() { printf 'WARN | %s\n' "$1"; }
bad() { printf 'FAIL | %s\n' "$1"; problems=$((problems + 1)); }

version_of() {
  # First dotted triple. Do not use a greedy prefix or "v22.23.4" becomes "2.23.4".
  printf '%s\n' "$1" | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1
}

at_least() {
  # $1 = found, $2 = minimum. Both are dotted triples. Works on macOS bash 3.2.
  local IFS=.
  local -a found_parts min_parts
  # shellcheck disable=SC2162
  read -a found_parts <<< "$1"
  # shellcheck disable=SC2162
  read -a min_parts <<< "$2"
  local i found_n min_n
  for i in 0 1 2; do
    found_n="${found_parts[$i]}"
    min_n="${min_parts[$i]}"
    if [ -z "$found_n" ]; then found_n=0; fi
    if [ -z "$min_n" ]; then min_n=0; fi
    if (( found_n > min_n )); then return 0; fi
    if (( found_n < min_n )); then return 1; fi
  done
  return 0
}

if command -v node >/dev/null 2>&1; then
  node_line="$(node --version 2>&1 | head -n 1)"
  node_ver="$(version_of "$node_line")"
  if [ -n "$node_ver" ] && at_least "$node_ver" "20.0.0"; then
    ok "node $node_line"
  else
    bad "node ${node_line:-unknown} is below 20"
  fi
else
  bad "node is not on PATH"
fi

if command -v claude >/dev/null 2>&1; then
  claude_line="$(claude --version 2>&1 | head -n 1)"
  claude_ver="$(version_of "$claude_line")"
  if [ -z "$claude_ver" ]; then
    bad "claude is on PATH but the version was not recognized"
  elif at_least "$claude_ver" "2.1.296"; then
    ok "claude $claude_line"
  else
    bad "claude $claude_ver is below 2.1.296. Run: claude update"
  fi
else
  bad "claude is not on PATH. Install @anthropic-ai/claude-code and log in with the class account."
fi

if command -v opencode >/dev/null 2>&1; then
  opencode_line="$(opencode --version 2>&1 | head -n 1)"
  ok "opencode $opencode_line"
else
  bad "opencode is not on PATH. See the course SETUP.md"
fi

if command -v duckdb >/dev/null 2>&1; then
  duck_line="$(duckdb --version 2>&1 | head -n 1)"
  ok "duckdb $duck_line"
else
  warn "duckdb is not on PATH. Install the DuckDB CLI before Lab 05. This warning does not fail the check."
fi

if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  bad "ANTHROPIC_API_KEY is set. Unset it so the class Claude account is used. Value not printed."
else
  ok "ANTHROPIC_API_KEY is empty"
fi

if [ -n "${OPENROUTER_API_KEY:-}" ]; then
  key_len="${#OPENROUTER_API_KEY}"
  if [ "$key_len" -ge 20 ]; then
    ok "OPENROUTER_API_KEY is set (${key_len} characters, value hidden)"
  else
    bad "OPENROUTER_API_KEY looks too short (${key_len} characters, value hidden)"
  fi
else
  bad "OPENROUTER_API_KEY is empty. Set the key from the training center in your user environment. Never commit it."
fi

if [ "$problems" -gt 0 ]; then
  printf 'check-machine: %s problem(s)\n' "$problems"
  exit 1
fi

printf 'check-machine: passed\n'
