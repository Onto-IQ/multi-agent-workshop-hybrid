# Data Cleaning Design Document

## Overview

This document describes the data cleaning pipeline for the Registry Insight dataset, converting the raw Thai Business Registration data (`dbd-2558.parquet`) into a clean, structured format suitable for analysis.

---

## 1. Garbage Row Filtering

### 1.1 What are Garbage Rows?

The raw dataset contains 9 garbage rows that are repeated header/legend rows, appearing at the beginning of each month's section:

- **Lines 2-5**: January header/legend
- **Lines 5986-5989**: February header/legend
- **Lines 11622-11625**: June header/legend

These rows contain:
- Month headers like "นิติบุคคลจัดตั้งเดือนมกราคม 2558"
- Legend descriptions like "ที่,เลขทะเบียน,ชื่อนิติบุคคล,วันที่จดทะเบียน"
- Special text " ทุนจดทะเบียน\r\n (บาท) " inside quotes

### 1.2 Filtering Criteria

**Primary Filter**: Presence of Thai text indicating a header/legend row

```sql
-- Filter out rows containing header/legend indicators
WHERE month IS NULL
   OR month LIKE '%จัดตั้งเดือน%'
   OR month LIKE '%ที่,เลขทะเบียน%'
   OR month LIKE '%ทุนจดทะเบียน%'
```

**Alternative Filter** (more precise): Check for empty or malformed data in key fields

```sql
-- Rows where month is empty OR seq is empty OR reg_date is empty
WHERE month IS NULL
   OR (seq IS NOT NULL AND seq = '')
   OR (reg_date IS NOT NULL AND reg_date = '')
```

### 1.3 Expected Result

- **Total rows before cleaning**: ~16,781
- **Total garbage rows**: 9
- **Total rows after cleaning**: **16,772**

---

## 2. Date Conversion: Buddhist Calendar to ISO

### 2.1 Current Format

Thai Buddhist calendar (พ.ศ.) format:
- Format: `d/m/2558` (day/month/Buddhist year)
- Example: `12/1/2558` → January 12, 2015
- Single-digit months/days may have leading zeros or not

### 2.2 Target Format

ISO 8601 format:
- Format: `YYYY-MM-DD` (Gregorian calendar)
- Example: `2015-01-12`

### 2.3 Conversion Logic

**Formula**:
```
Gregorian Year = Buddhist Year - 543
Gregorian Month = Thai Month (1-12)
Gregorian Day = Thai Day (1-31)
```

**Implementation**:

```sql
-- Extract day, month, and Buddhist year
WITH parsed_dates AS (
  SELECT
    *,
    -- Split the date string into components
    -- Pattern: d/m/2558 (supports both single and double digits)
    regexp_extract(reg_date, '^(\d{1,2})/(\d{1,2})/(\d{4})$', 1) AS day,
    regexp_extract(reg_date, '^(\d{1,2})/(\d{1,2})/(\d{4})$', 2) AS month,
    regexp_extract(reg_date, '^(\d{1,2})/(\d{1,2})/(\d{4})$', 3) AS buddhist_year
  FROM source_data
)
SELECT
  *,
  -- Convert to ISO format: YYYY-MM-DD
  -- Gregorian year = Buddhist year - 543
  CAST(
    (buddhist_year - 543) AS VARCHAR) || '-' ||
    LPAD(month, 2, '0') || '-' ||
    LPAD(day, 2, '0')
  AS reg_date_iso
FROM parsed_dates;
```

### 2.4 Examples

| Input (พ.ศ.) | Output (ค.ศ.) | Date |
|-------------|--------------|------|
| `12/1/2558` | `2015-01-12` | January 12, 2015 |
| `5/1/2558` | `2015-01-05` | January 5, 2015 |
| `27/1/2558` | `2015-01-27` | January 27, 2015 |
| `12/12/2558` | `2015-12-12` | December 12, 2015 |

**Total affected rows**: 16,772

---

## 3. Province Extraction from Address

### 3.1 Current State

The `province` field is **empty** in all rows and must be extracted from the `address` field.

### 3.2 Address Format

Addresses follow this pattern:
```
[Number] [Street Name] แขวง[Subdistrict] เขต[District] [Province Name] [Postal Code]
```

Example:
```
1 อาคารกลาสเฮ้าส์ ชั้นที่ 12 ซอยสุขุมวิท 25 ถนนสุขุมวิท  แขวงคลองเตยเหนือ เขตวัฒนา กรุงเทพมหานคร 10110
```

### 3.3 Extraction Logic

The extraction algorithm (from `lib/inspect-data.js`) works as follows:

#### Step 1: Find Province Name in Address

1. **Primary search**: Look for any of the 77 province names in the address
2. **Preference**: Choose the province that appears **closest to the end** of the address
3. **Fallback**: If no province name found, extract from "จ.XXX" pattern

#### Step 2: Province Names (77 total)

The dataset includes all 77 Thai provinces:

**Central Region (กลาง)**:
- กรุงเทพมหานคร, นนทบุรี, ปทุมธานี, พระนครศรีอยุธยา, อ่างทอง, ลพบุรี, สิงห์บุรี, ชัยนาท, สระบุรี, สุพรรณบุรี, นครปฐม, สมุทรปราการ, สมุทรสาคร, สมุทรสงคราม, นครนายก

**Eastern Region (ตะวันออก)**:
- ชลบุรี, ระยอง, จันทบุรี, ตราด, ฉะเชิงเทรา, ปราจีนบุรี, สระแก้ว

**Western Region (ตะวันตก)**:
- กาญจนบุรี, เพชรบุรี, ประจวบคีรีขันธ์, ราชบุรี

**Northern Region (เหนือ)**:
- เชียงใหม่, ลำพูน, ลำปาง, อุตรดิตถ์, แพร่, น่าน, พะเยา, เชียงราย, แม่ฮ่องสอน, นครสวรรค์, อุทัยธานี, กำแพงเพชร, ตาก, สุโขทัย, พิษณุโลก, พิจิตร, เพชรบูรณ์

**Northeastern Region (อีสาน)**:
- ขอนแก่น, อุดรธานี, หนองบัวลำภู, หนองคาย, บึงกาฬ, เลย, มหาสารคาม, ร้อยเอ็ด, กาฬสินธุ์, สกลนคร, นครพนม, มุกดาหาร, ชัยภูมิ, นครราชสีมา, บุรีรัมย์, สุรินทร์, ศรีสะเกษ, อุบลราชธานี, ยโสธร, อำนาจเจริญ

**Southern Region (ใต้)**:
- นครศรีธรรมราช, กระบี่, พังงา, สุราษฎร์ธานี, พัทลุง, สงขลา, สตูล, ตรัง, ภูเก็ต, ปัตตานี, ยะลา, นราธิวาส, ชุมพร, ระนอง

#### Step 3: Implementation

```sql
-- Create a table with all 77 province names
WITH province_map AS (
  SELECT 'กรุงเทพมหานคร' AS province UNION ALL
  SELECT 'นนทบุรี' UNION ALL
  SELECT 'ปทุมธานี' UNION ALL
  -- ... all 77 provinces
)
SELECT
  *,
  -- Find province closest to the end of address
  (SELECT province
   FROM province_map
   WHERE address LIKE '%' || province || '%'
   ORDER BY LENGTH(address) - LENGTH(address LIKE '%' || province || '%') DESC
   LIMIT 1) AS province
FROM source_data;
```

### 3.4 Examples

| Address | Extracted Province |
|---------|-------------------|
| `1 อาคารกลาสเฮ้าส์ ชั้นที่ 12 ซอยสุขุมวิท 25 ถนนสุขุมวิท  แขวงคลองเตยเหนือ เขตวัฒนา กรุงเทพมหานคร 10110` | `กรุงเทพมหานคร` |
| `67 ซอยปากน้ำกระโจมทอง 39  แขวงบางพรม เขตตลิ่งชัน กรุงเทพมหานคร 10170` | `กรุงเทพมหานคร` |
| `118/1 ถนนวิภาวดีรังสิต  แขวงจอมพล เขตจตุจักร กรุงเทพมหานคร 10900` | `กรุงเทพมหานคร` |
| `44/1 อาคารรุ่งโรจน์ธนกุล ชั้นที่ 16 ถนนรัชดาภิเษก  แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพมหานคร 10310` | `กรุงเทพมหานคร` |

**Total affected rows**: 16,772

---

## 4. Field Cleaning

### 4.1 Capital Field

**Current format**: `" 2,000,000,000 "` (with commas and spaces)

**Target format**: `2000000000` (numeric without commas or spaces)

**Special cases**: 2 rows have no commas (15 baht, 500 baht) — keep as-is

**Implementation**:
```sql
-- Remove commas and spaces, convert to numeric
CAST(
  REPLACE(REPLACE(regexp_replace(capital, '[\s,]', ''), ' ', ''), ' ', '')
  AS BIGINT
) AS capital_clean
```

**Affected rows**: 16,770 (all except 2 special cases)

### 4.2 Seq Field

**Current format**: `"1,000"` (with commas)

**Target format**: `1000` (numeric, integer ≥ 1)

**Implementation**:
```sql
-- Remove commas, convert to integer
CAST(REPLACE(seq, ',', '') AS INT) AS seq_clean
```

**Affected rows**: 3,239

### 4.3 Quote Fields with Newlines

**Fields affected**: `address` and `objective`

**Issue**: These fields may contain newlines, which break CSV format

**Solution**: Wrap fields in quotes when exporting to CSV

```sql
-- Quote the address and objective fields
QUOTE(address) AS address_quoted,
QUOTE(objective) AS objective_quoted
```

**Affected rows**: 124 for `address`, 81 for `objective`

---

## 5. Final Data Structure

### 5.1 Column List

1. `month` (text)
2. `seq` (integer, cleaned)
3. `reg_no` (text, 13 digits, unchanged)
4. `company_name` (text, unchanged)
5. `reg_date` (text, ISO format: YYYY-MM-DD)
6. `capital` (bigint, numeric without commas)
7. `objective` (text, quoted if contains newlines)
8. `address` (text, quoted if contains newlines)
9. `province` (text, extracted from address)

### 5.2 Expected Statistics

- **Total rows**: 16,772
- **Total capital**: 45,341,868,784 baht
- **Unique companies**: 16,772 (based on reg_no)
- **Provinces**: All 77 Thai provinces
- **Regions**: 5 regions (กลาง, ตะวันออก, ตะวันตก, เหนือ, อีสาน, ใต้)

---

## 6. Validation Rules

### 6.1 Quality Checks

The cleaned data must pass all rules in `lib/inspect-data.js`:

1. **seq**: Integer ≥ 1
2. **reg_no**: Exactly 13 digits
3. **company_name**: Not empty
4. **reg_date**: ISO format (YYYY-MM-DD)
5. **capital**: Numeric, ≥ 0
6. **objective**: Not empty
7. **province**: Valid province name from PROVINCE_REGION

### 6.2 Final Validation

Run `npm run gate` and ensure all 6 quality gate tests pass:
- `data-quality`: All validation rules pass
- `summary-matches-valid-rows`: Summary matches cleaned data
- `bad-json-does-not-crash`: No crashes on malformed data
- `health-no-secrets`: No secrets exposed
- `notes-validation`: Notes validation passes
- `notes-persists`: Notes persist across restarts

---

## 7. Technical Implementation

### 7.1 DuckDB Setup

```sql
-- Install DuckDB extension for Parquet reading
INSTALL parquet;
LOAD parquet;

-- Create connection to Parquet file
CREATE TABLE source_data AS
SELECT * FROM read_parquet('data/raw/dbd-2558.parquet');
```

### 7.2 Complete Cleaning Pipeline

```sql
-- Step 1: Create source table
CREATE TABLE source_data AS
SELECT * FROM read_parquet('data/raw/dbd-2558.parquet');

-- Step 2: Filter garbage rows
CREATE TABLE filtered_data AS
SELECT *
FROM source_data
WHERE month IS NULL
   OR month LIKE '%จัดตั้งเดือน%'
   OR month LIKE '%ที่,เลขทะเบียน%'
   OR month LIKE '%ทุนจดทะเบียน%';

-- Step 3: Clean and convert dates
CREATE TABLE cleaned_data AS
WITH parsed_dates AS (
  SELECT
    *,
    regexp_extract(reg_date, '^(\d{1,2})/(\d{1,2})/(\d{4})$', 1) AS day,
    regexp_extract(reg_date, '^(\d{1,2})/(\d{1,2})/(\d{4})$', 2) AS month,
    regexp_extract(reg_date, '^(\d{1,2})/(\d{1,2})/(\d{4})$', 3) AS buddhist_year
  FROM filtered_data
)
SELECT
  *,
  CAST((buddhist_year - 543) AS VARCHAR) || '-' ||
    LPAD(month, 2, '0') || '-' ||
    LPAD(day, 2, '0') AS reg_date
FROM parsed_dates;

-- Step 4: Extract provinces (using lib/inspect-data.js logic)
CREATE TABLE final_data AS
WITH province_map AS (
  SELECT 'กรุงเทพมหานคร' AS province UNION ALL
  SELECT 'นนทบุรี' UNION ALL
  -- ... all 77 provinces
)
SELECT
  *,
  (SELECT province
   FROM province_map
   WHERE address LIKE '%' || province || '%'
   ORDER BY LENGTH(address) - LENGTH(address LIKE '%' || province || '%') DESC
   LIMIT 1) AS province
FROM cleaned_data;

-- Step 5: Clean capital and seq
CREATE TABLE cleaned_final AS
SELECT
  month,
  CAST(REPLACE(seq, ',', '') AS INT) AS seq,
  reg_no,
  company_name,
  reg_date,
  CAST(REPLACE(REPLACE(regexp_replace(capital, '[\s,]', ''), ' ', ''), ' ', '') AS BIGINT) AS capital,
  objective,
  address,
  province
FROM final_data;

-- Step 6: Export to CSV
COPY cleaned_final TO 'data/dataset.csv' (HEADER, DELIMITER ',');
```

---

## 8. Notes

- **Do NOT modify `scripts/quality-gate.js`**: This is the automated quality gate
- **Do NOT modify `server.js`**: This is for backend track
- **Follow the task breakdown**: Focus on data track only
- **Run `npm run gate` before completion**: Ensure all tests pass
- **Exit code should be 0**: Quality gate must pass
