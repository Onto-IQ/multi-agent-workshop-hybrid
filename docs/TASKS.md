# TASKS — Registry Insight App (Lab 02)

## CONSTRAINTS & RULES

### ⚠️ CRITICAL RESTRICTIONS
- **DO NOT modify `scripts/quality-gate.js`** — This is the automated quality gate that validates the application
- **DO NOT plan to modify `/api/notes` or `/api/health` in this lab** — These endpoints are read-only in production (Vercel) and should not be changed

### ⚠️ PRODUCTION MODE
- **On Vercel (`process.env.VERCEL`)**: All `data/notes.json` operations are READ-ONLY. No `writeFile`, `appendFile`, or `createWriteStream` allowed.
- **On local development**: Notes should persist to `data/notes.json` after POST requests

---

## TRACK 1: DATA CLEANING

**Owner**: Backend Developer (ผู้เขียนโค้ดส่วนหลัง)

### 1.1 Clean the CSV dataset
**File**: `data/dataset.csv`

**Tasks**:
1.1.1 Remove the 9 garbage rows (header/legend rows that repeat every month)
   - Lines 2-5 (jan), 5986-5989 (feb), 11622-11625 (jun)
   - These contain " ทุนจดทะเบียน\r\n (บาท) " inside quotes

1.1.2 Fix `reg_date` format
   - Convert all dates from Thai calendar (พ.ศ.) to ISO format (ค.ศ.)
   - Format: `d/m/2558` → `YYYY-MM-DD`
   - Example: `12/1/2558` → `2015-01-12`
   - **Total affected rows**: 16,772

1.1.3 Clean `capital` field
   - Remove commas: `" 2,000,000,000 "` → `"2000000000"`
   - Remove leading/trailing spaces
   - **Total affected rows**: 16,770
   - Special cases: 2 rows have no commas (15 baht, 500 baht) — keep as-is

1.1.4 Clean `seq` field
   - Remove commas: `"1,000"` → `"1000"`
   - Keep as integer ≥ 1
   - **Total affected rows**: 3,239

1.1.5 Extract `province` from `address` field
   - Use `lib/inspect-data.js` → `extractProvince(address)`
   - Map address to province using `PROVINCE_REGION` (77 provinces + regions)
   - **Total affected rows**: 16,772
   - All rows currently have empty province

1.1.6 Add quotes to fields with newlines
   - Fields `address` and `objective` that contain newlines need to be quoted
   - **Affected rows**: 124 for `address`, 81 for `objective`

1.1.7 Keep `reg_no` as text (13 digits)
   - Do NOT convert to number (leading zeros would be lost)
   - Format: `"1000000000001"` (text string)

1.1.8 Validate final output
   - Row count: **16,772** (9 garbage rows removed)
   - Total capital: **45,341,868,784** baht
   - All columns pass quality rules in `lib/inspect-data.js`
   - Matches README expectations

**Acceptance Criteria**:
- `data/dataset.csv` has 16,772 rows
- All `reg_date` values are in ISO format (YYYY-MM-DD)
- All `capital` values are numeric without commas
- All `province` values are populated
- All 6 quality gate tests pass

---

## TRACK 2: BACKEND REFACTORING

**Owner**: Backend Developer (ผู้เขียนโค้ดส่วนหลัง)

### 2.1 Fix `/api/summary` endpoint
**File**: `server.js` (lines 139-146 → `summaryFromCsv()` lines 69-85)

**Tasks**:
2.1.1 Fix CSV parsing
   - Replace naive `split(',')` with proper CSV parser that handles quoted fields
   - Use `lib/csv.js` (currently not used, needs to be integrated)
   - Or use a simple regex-based parser that handles quoted strings with commas

2.1.2 Fix capital calculation
   - Remove `capital_raw` field reference
   - Use cleaned `capital` field from CSV
   - Ensure commas are already removed before parsing

2.1.3 Fix row counting
   - Filter out header/legend rows during parsing
   - Only count valid business records
   - Ensure `companyCount` matches `analyze().stats.companyCount`

2.1.4 Add error handling
   - Return `{error:'SUMMARY_FAILED'}` on any error (currently does this, but ensure it's robust)

**Acceptance Criteria**:
- `/api/summary` returns valid `companyCount` (> 0)
- `/api/summary` returns valid `totalCapital` (> 0)
- Values match `analyze().stats` exactly (not just approximately)
- No crashes on malformed data

---

### 2.2 Fix `/api/notes` endpoint
**File**: `server.js` (lines 149-169)

**Tasks**:
2.2.1 Add JSON error handling
   - Wrap `JSON.parse(raw)` in try/catch
   - Return 400 Bad Request for invalid JSON
   - Process should not crash if JSON is malformed

2.2.2 Add request validation
   - Reject `{nope:1}` (empty text) with 400
   - Only accept valid JSON with `text` field
   - Validate `text` is a string and not empty

2.2.3 Implement persistent storage
   - After each POST, write note to `data/notes.json`
   - Load existing notes from `data/notes.json` on GET
   - Handle `process.env.VERCEL` (read-only mode)
   - On Vercel: GET returns demo data, POST returns 405 NOTEPREADONLY

2.2.4 Handle file corruption
   - If `data/notes.json` is corrupted or empty, start fresh
   - Do NOT crash server when reading/writing notes file

**Acceptance Criteria**:
- POST `/api/notes` with valid JSON returns 201 Created
- POST `/api/notes` with invalid JSON returns 400 Bad Request
- POST `/api/notes` with `{nope:1}` returns 400 Bad Request
- POST `/api/notes` persists to `data/notes.json`
- GET `/api/notes` returns saved notes after restart
- On Vercel, POST returns 405 NOTEPREADONLY

---

### 2.3 Fix `/api/health` endpoint
**File**: `server.js` (lines 134-136)

**Tasks**:
2.3.1 Remove `sampleToken` from response
   - Currently returns `{ ok: true, sampleToken: SAMPLE_TOKEN }`
   - Remove `sampleToken` field entirely
   - Ensure no `sk-***` or secret tokens are exposed

2.3.2 Keep only `ok: true`
   - Response should be `{ ok: true }`

**Acceptance Criteria**:
- `/api/health` returns `{ ok: true }`
- No `sampleToken` or any `sk-***` in response
- Quality gate test `health-no-secrets` passes

---

### 2.4 Update quality gate integration
**File**: `lib/inspect-data.js`

**Tasks**:
2.4.1 Ensure `analyze()` matches quality gate rules
   - Verify all validation rules in `lib/inspect-data.js` match `scripts/quality-gate.js`
   - Test with cleaned `data/dataset.csv`

2.4.2 Verify region mapping
   - Ensure `PROVINCE_REGION` covers all 77 provinces
   - Verify `extractProvince()` works for all addresses

**Acceptance Criteria**:
- `analyze(data/dataset.csv).violations.length === 0`
- All 6 quality gate tests pass

---

## TRACK 3: FRONTEND VALIDATION

**Owner**: QA Tester / Frontend Developer (ผู้ทดสอบและตรวจสอบ)

### 3.1 Test `/api/summary` endpoint
**Tasks**:
3.1.1 Verify `companyCount` is > 0
3.1.2 Verify `totalCapital` is > 0 and matches expected value (45,341,868,784)
3.1.3 Verify response format matches expected structure
3.1.4 Test error handling (should return 500 with `{error:'SUMMARY_FAILED'}` on any error)

**Acceptance Criteria**:
- `/api/summary` returns valid counts
- Values match `analyze().stats` exactly

---

### 3.2 Test `/api/notes` endpoint
**Tasks**:
3.2.1 POST with valid JSON → 201 Created, note saved to file
3.2.2 POST with invalid JSON → 400 Bad Request, process continues
3.2.3 POST with `{nope:1}` → 400 Bad Request, no note saved
3.2.4 GET after POST → returns saved note
3.2.5 Restart server → notes persist from `data/notes.json`
3.2.6 On Vercel → GET returns demo data, POST returns 405 NOTEPREADONLY

**Acceptance Criteria**:
- All POST/GET operations work correctly
- Notes persist across server restarts (local only)
- Vercel behaves as read-only

---

### 3.3 Test `/api/health` endpoint
**Tasks**:
3.3.1 Verify response is `{ ok: true }`
3.3.2 Verify no `sampleToken` or `sk-***` in response
3.3.3 Verify quality gate test `health-no-secrets` passes

**Acceptance Criteria**:
- Response matches expected format
- No secrets exposed

---

### 3.4 Test static files
**Tasks**:
3.4.1 Verify `/`, `/index.html`, `/styles.css`, `/app.js` are served correctly
3.4.2 Verify other paths return 404 JSON

**Acceptance Criteria**:
- Static files serve correctly
- Unknown paths return 404

---

### 3.5 End-to-end testing
**Tasks**:
3.5.1 Start server: `npm start`
3.5.2 Run quality gate: `npm run gate`
3.5.3 Verify all 6 tests pass
3.5.4 Restart server and verify tests still pass
3.5.5 Test on Vercel (if deployed) and verify read-only behavior

**Acceptance Criteria**:
- All 6 quality gate tests pass consistently
- Server restarts don't break tests
- Vercel behaves correctly

---

## DELIVERABLES

### For Backend Developer:
1. Cleaned `data/dataset.csv` (16,772 rows)
2. Fixed `server.js` endpoints (`/api/summary`, `/api/notes`, `/api/health`)
3. Updated `lib/inspect-data.js` if needed
4. Verified all quality gate tests pass

### For QA Tester:
1. Test results for all endpoints
2. Bug reports (if any)
3. Confirmation that all 6 quality gate tests pass

### For All:
1. Run `npm run gate` and report exit code
2. Ensure no files were modified without authorization
3. Ensure no secrets were exposed

---

## COMPLETION CHECKLIST

- [ ] `data/dataset.csv` cleaned (16,772 rows, all fields valid)
- [ ] `/api/summary` returns valid counts
- [ ] `/api/notes` validates input and persists to file
- [ ] `/api/notes` handles errors gracefully
- [ ] `/api/health` returns no secrets
- [ ] All 6 quality gate tests pass
- [ ] Frontend endpoints work correctly
- [ ] Notes persist across server restarts (local)
- [ ] Vercel read-only mode works (no writes on Vercel)
- [ ] No modifications to `scripts/quality-gate.js`
- [ ] No modifications planned for `/api/notes` or `/api/health`
- [ ] `npm run gate` exit code is 0

---

## NOTES

### Data Cleaning Notes:
- 9 garbage rows must be removed (header/legend rows)
- Date conversion: Thai to Gregorian calendar
- Capital cleaning: Remove commas and spaces
- Province extraction: Use `extractProvince()` from `lib/inspect-data.js`
- Quote fields with newlines: `address` and `objective`

### Backend Notes:
- Use proper CSV parser for quoted fields
- Handle JSON parsing errors
- Persist notes to `data/notes.json` (except on Vercel)
- Remove secrets from `/api/health`
- Ensure `totalCapital` matches exactly (use `analyze()` for comparison)

### Quality Gate Notes:
- All 6 tests must pass: `data-quality`, `summary-matches-valid-rows`, `bad-json-does-not-crash`, `health-no-secrets`, `notes-validation`, `notes-persists`
- Run `npm run gate` before completion
- Exit code should be 0
