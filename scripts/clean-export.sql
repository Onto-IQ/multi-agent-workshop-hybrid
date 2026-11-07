-- Workshop 3 (สาย data): ทำความสะอาดข้อมูลจดทะเบียนนิติบุคคล พ.ศ. 2558 แล้วส่งออก
-- เป็นตารางแบนที่แอปอ่านต่อ รันจากราก workshop repo:
--
--   duckdb -c ".read scripts/clean-export.sql"
--
-- แหล่งข้อมูลจริง: data/raw/dbd-2558.parquet (แปลงจาก CSV ของ data.go.th)
-- เกณฑ์ที่ต้องผ่านอ่านได้ที่ lib/inspect-data.js และ data/README.md
-- จังหวัดดึงจากที่อยู่: เลือกชื่อจังหวัดที่ปรากฏ "ใกล้ท้ายที่อยู่ที่สุด"
-- (ที่อยู่อาจพูดถึงจังหวัดอื่นกลางประโยค เช่น ถนนบางนา-ตราด ซึ่งอยู่ในกรุงเทพฯ)

COPY (
  WITH base AS (
    SELECT
      month,
      CAST(replace(seq_raw, ',', '') AS BIGINT) AS seq,
      reg_no,
      trim(company_name) AS company_name,
      strftime(strptime(reg_date_raw, '%d/%m/%Y') - INTERVAL 543 YEAR, '%Y-%m-%d') AS reg_date,
      CAST(replace(capital_raw, ',', '') AS DECIMAL(18, 2)) AS capital,
      trim(objective) AS objective,
      address
    FROM read_parquet('data/raw/dbd-2558.parquet')
    WHERE try_cast(replace(seq_raw, ',', '') AS BIGINT) IS NOT NULL
      AND regexp_matches(reg_no, '^[0-9]{13}$')
      AND length(trim(company_name)) > 0
      AND length(trim(objective)) > 0
      AND try_cast(replace(capital_raw, ',', '') AS DECIMAL(18, 2)) IS NOT NULL
      AND try_strptime(reg_date_raw, '%d/%m/%Y') IS NOT NULL
  ),
  matched AS (
    SELECT
      b.*,
      p.name AS province,
      strpos(b.address, p.name) AS name_pos
    FROM base b
    JOIN (VALUES
      ('กรุงเทพมหานคร'), ('นนทบุรี'), ('ปทุมธานี'), ('พระนครศรีอยุธยา'), ('อ่างทอง'),
      ('ลพบุรี'), ('สิงห์บุรี'), ('ชัยนาท'), ('สระบุรี'), ('สุพรรณบุรี'), ('นครปฐม'),
      ('สมุทรปราการ'), ('สมุทรสาคร'), ('สมุทรสงคราม'), ('นครนายก'),
      ('ชลบุรี'), ('ระยอง'), ('จันทบุรี'), ('ตราด'), ('ฉะเชิงเทรา'), ('ปราจีนบุรี'),
      ('สระแก้ว'), ('กาญจนบุรี'), ('เพชรบุรี'), ('ประจวบคีรีขันธ์'), ('ราชบุรี'),
      ('เชียงใหม่'), ('ลำพูน'), ('ลำปาง'), ('อุตรดิตถ์'), ('แพร่'), ('น่าน'), ('พะเยา'),
      ('เชียงราย'), ('แม่ฮ่องสอน'), ('นครสวรรค์'), ('อุทัยธานี'), ('กำแพงเพชร'), ('ตาก'),
      ('สุโขทัย'), ('พิษณุโลก'), ('พิจิตร'), ('เพชรบูรณ์'),
      ('ขอนแก่น'), ('อุดรธานี'), ('หนองบัวลำภู'), ('หนองคาย'), ('บึงกาฬ'), ('เลย'),
      ('มหาสารคาม'), ('ร้อยเอ็ด'), ('กาฬสินธุ์'), ('สกลนคร'), ('นครพนม'), ('มุกดาหาร'),
      ('ชัยภูมิ'), ('นครราชสีมา'), ('บุรีรัมย์'), ('สุรินทร์'), ('ศรีสะเกษ'),
      ('อุบลราชธานี'), ('ยโสธร'), ('อำนาจเจริญ'),
      ('นครศรีธรรมราช'), ('กระบี่'), ('พังงา'), ('สุราษฎร์ธานี'), ('พัทลุง'),
      ('สงขลา'), ('สตูล'), ('ตรัง'), ('ภูเก็ต'), ('ปัตตานี'), ('ยะลา'), ('นราธิวาส'),
      ('ชุมพร'), ('ระนอง')
    ) AS p(name) ON strpos(b.address, p.name) > 0
  ),
  picked AS (
    SELECT *, row_number() OVER (PARTITION BY reg_no ORDER BY name_pos DESC, length(province) DESC) AS rn
    FROM matched
  )
  SELECT month, seq, reg_no, company_name, reg_date, capital, objective, address, province
  FROM picked
  WHERE rn = 1
) TO 'data/dataset.csv' (HEADER, DELIMITER ',');
