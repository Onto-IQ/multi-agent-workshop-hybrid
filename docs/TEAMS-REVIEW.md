# Teams Review of EXPLORATION-REPORT.md

Team: structure-scout, data-scout, devil-advocate. `npm run gate` exited 2, with 0 of 6 cases passing.

## Agreement

- All runtime-layout claims are confirmed: binds to 127.0.0.1, `require.main` guard, exports, `naiveRecords`, `capital_raw`, `SAMPLE_TOKEN`, in-memory notes, no `api/` or `vercel.json`.
- Data claims are confirmed: 16,781 rows, 9 junk rows, 16,772 bad dates, 124 quoted addresses, targets 16,772 / 45,341,868,784.
- All 6 gate FAIL texts match the report's table.
- The header passes `analyze()` today, but the documented contract lists 8 columns (`data/README.md:9-20`) while the checker requires 9, including `province` (`lib/inspect-data.js:38`). The report misses this risk.

## Disputed

- `docs/EXPLORATION-REPORT.md:76` says "thousands" of rows. The server actually counts exactly 16,778, because a quoted newline splits the Thai header (`data/dataset.csv:4-5`).
- `docs/EXPLORATION-REPORT.md:88` overstates `Boolean("0")`. The bigger risk is that the gate inherits `VERCEL` from the parent shell (`scripts/quality-gate.js:129`), so POST gets a 405 (`server.js:155`).
- `docs/EXPLORATION-REPORT.md:86-87`: the sync read and unbounded body are low risk locally (`server.js:28`). They matter again in Lab 11.

## Missing risks

- The write to `data/notes.json` is not atomic, so a SIGKILL can leave it half-written (`scripts/quality-gate.js:112`).
- `opencode.json:42` allows every bash command, which gets around the gate edit-deny at `:39`.
- `ONTOIQ_API_KEY` appears only in `AGENTS.md:19`, so `CLAUDE.md` and `AGENTS.md` are out of sync.

## Next sequential step

Before Lab 05, decide whether `province` is part of the column contract. Then make `data/README.md`, `CLAUDE.md` and `AGENTS.md` agree with `lib/inspect-data.js:38`.
