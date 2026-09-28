import { getPool } from './pool';

export const MA_HO_SO_PATTERN = /^\d{10}$/;

export type PatientInfo = {
  hisPatienthistoryId: string;
  maHoSo: string;
  maNb: string | null;
  maBenhAn: string | null;
  tenNb: string;
  tuoi: number | null;
  ngaySinh: string | null;
  gioiTinh: string | null;
};

export type MedicationLine = {
  hisServiceProductId: string;
  tenThuoc: string | null;
  lieuDung: string | null;
  cachDung: string | null;
  duongDung: string | null;
  thoiGianKe: string | null;
  thoiGianThucHien: string | null;
  soLuong: number | null;
  dvt: string | null;
  tocDoTruyen: number | null;
  donViTocDo: string | null;
};

export type TreatmentOrder = {
  /** createdfromrecord_id (= nb_to_dieu_tri_id); null = ungrouped lines. */
  toDieuTriId: string | null;
  /** Earliest docdate in the group. */
  thoiGianKe: string | null;
  medicationCount: number;
  medications: MedicationLine[];
};

export type LookupResult = {
  patient: PatientInfo;
  orders: TreatmentOrder[];
  /** Number of his_patienthistory rows matched before picking one. */
  matchCount: number;
};

type MedicationRow = MedicationLine & {
  toDieuTriId: string | null;
};

export type ParseMaHoSoResult =
  { ok: true; maHoSo: string; dateHint: string } | { ok: false; error: string };

export type ParseMaBenhAnResult =
  { ok: true; maBenhAn: string } | { ok: false; error: string };

type PatientRow = {
  his_patienthistory_id: string;
  name: string;
  birthday: Date | null;
  age: string | null;
  birthdaystr: string | null;
  his_gender: string | null;
  his_patientdocument: string;
  value: string | null;
  his_medicalrecordno: string | null;
};

/**
 * Mã hồ sơ = YYMMDD + 4-digit daily sequence (e.g. 2609230012).
 * Looks up his_patientdocument only — never his_patienthistory.value (mã NB).
 */
export function parseMaHoSo(raw: string): ParseMaHoSoResult {
  const maHoSo = raw.trim();
  if (!MA_HO_SO_PATTERN.test(maHoSo)) {
    return {
      ok: false,
      error: `Invalid mã hồ sơ "${maHoSo}". Expected 10 digits (YYMMDD + STT).`
    };
  }

  const yy = Number(maHoSo.slice(0, 2));
  const mm = Number(maHoSo.slice(2, 4));
  const dd = Number(maHoSo.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    return {
      ok: false,
      error: `Invalid date prefix in mã hồ sơ "${maHoSo}" (YYMMDD).`
    };
  }

  const year = 2000 + yy;
  const dateHint = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  return { ok: true, maHoSo, dateHint };
}

/**
 * Mã bệnh án = his_medicalrecordno (variable length; may repeat across encounters).
 */
export function parseMaBenhAn(raw: string): ParseMaBenhAnResult {
  const maBenhAn = raw.trim();
  if (!maBenhAn) {
    return { ok: false, error: 'Mã bệnh án không được để trống.' };
  }
  if (maBenhAn.length > 64) {
    return { ok: false, error: 'Mã bệnh án quá dài (max 64).' };
  }
  return { ok: true, maBenhAn };
}

function toIsoOrNull(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolveAge(row: {
  age: unknown;
  birthday: Date | string | null;
  birthdaystr: string | null;
}): number | null {
  const fromAge = toNumberOrNull(row.age);
  if (fromAge != null) {
    return fromAge;
  }

  if (row.birthday) {
    const birth =
      row.birthday instanceof Date ? row.birthday : new Date(row.birthday);
    if (!Number.isNaN(birth.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
        age -= 1;
      }
      return age >= 0 ? age : null;
    }
  }

  if (row.birthdaystr && /^\d{4}/.test(row.birthdaystr)) {
    const year = Number(row.birthdaystr.slice(0, 4));
    if (Number.isFinite(year)) {
      return new Date().getFullYear() - year;
    }
  }

  return null;
}

function mapPatient(row: PatientRow): PatientInfo {
  return {
    hisPatienthistoryId: String(row.his_patienthistory_id),
    maHoSo: row.his_patientdocument,
    maNb: row.value,
    maBenhAn: row.his_medicalrecordno,
    tenNb: row.name,
    tuoi: resolveAge(row),
    ngaySinh: toIsoOrNull(row.birthday),
    gioiTinh: row.his_gender
  };
}

async function fetchMedicationRows(
  patientHistoryId: string
): Promise<MedicationRow[]> {
  const db = getPool();
  const medsResult = await db.query<{
    his_service_product_id: string;
    createdfromrecord_id: string | null;
    ten_thuoc: string | null;
    his_usage: string | null;
    cach_dung: string | null;
    duong_dung: string | null;
    docdate: Date | null;
    actdate: Date | null;
    quantity: string | null;
    dvt: string | null;
    transferrate: string | null;
    transferunit: string | null;
  }>(
    `
    SELECT
      sp.his_service_product_id,
      sp.createdfromrecord_id,
      COALESCE(hp.name, sp.servicename) AS ten_thuoc,
      sp.his_usage,
      dos.name AS cach_dung,
      mu.name AS duong_dung,
      sp.docdate,
      sp.actdate,
      sp.quantity,
      uom.name AS dvt,
      sp.transferrate,
      sp.transferunit
    FROM adempiere.his_service_product sp
    LEFT JOIN adempiere.his_product hp
      ON hp.his_service_id = sp.his_service_id
    LEFT JOIN adempiere.his_methoduse mu
      ON mu.his_methoduse_id = sp.his_methoduse_id
    LEFT JOIN adempiere.his_dosage dos
      ON dos.his_dosage_id = sp.his_dosage_id
    LEFT JOIN adempiere.c_uom uom
      ON uom.c_uom_id = COALESCE(sp.c_uom_id, hp.c_uom_id)
    WHERE sp.his_patienthistory_id = $1
      AND sp.isdeleted = 'N'
      AND sp.isactive = 'Y'
    ORDER BY sp.docdate NULLS LAST, sp.actdate NULLS LAST, sp.seqno NULLS LAST
    `,
    [patientHistoryId]
  );

  return medsResult.rows.map((row) => ({
    hisServiceProductId: String(row.his_service_product_id),
    toDieuTriId:
      row.createdfromrecord_id == null
        ? null
        : String(row.createdfromrecord_id),
    tenThuoc: row.ten_thuoc,
    lieuDung: row.his_usage,
    cachDung: row.cach_dung,
    duongDung: row.duong_dung,
    thoiGianKe: toIsoOrNull(row.docdate),
    thoiGianThucHien: toIsoOrNull(row.actdate),
    soLuong: toNumberOrNull(row.quantity),
    dvt: row.dvt,
    tocDoTruyen: toNumberOrNull(row.transferrate),
    donViTocDo: row.transferunit
  }));
}

function earliestIso(a: string | null, b: string | null): string | null {
  if (a == null) {
    return b;
  }
  if (b == null) {
    return a;
  }
  return a <= b ? a : b;
}

function groupIntoOrders(rows: MedicationRow[]): TreatmentOrder[] {
  const byKey = new Map<string, TreatmentOrder>();
  const orderKeys: string[] = [];

  for (const row of rows) {
    const key = row.toDieuTriId ?? '__null__';
    let order = byKey.get(key);
    if (!order) {
      order = {
        toDieuTriId: row.toDieuTriId,
        thoiGianKe: row.thoiGianKe,
        medicationCount: 0,
        medications: []
      };
      byKey.set(key, order);
      orderKeys.push(key);
    }

    const line: MedicationLine = {
      hisServiceProductId: row.hisServiceProductId,
      tenThuoc: row.tenThuoc,
      lieuDung: row.lieuDung,
      cachDung: row.cachDung,
      duongDung: row.duongDung,
      thoiGianKe: row.thoiGianKe,
      thoiGianThucHien: row.thoiGianThucHien,
      soLuong: row.soLuong,
      dvt: row.dvt,
      tocDoTruyen: row.tocDoTruyen,
      donViTocDo: row.donViTocDo
    };
    order.medications.push(line);
    order.medicationCount = order.medications.length;
    order.thoiGianKe = earliestIso(order.thoiGianKe, row.thoiGianKe);
  }

  const orders = orderKeys.map((key) => byKey.get(key)!);
  orders.sort((a, b) => {
    if (a.thoiGianKe == null && b.thoiGianKe == null) {
      return 0;
    }
    if (a.thoiGianKe == null) {
      return 1;
    }
    if (b.thoiGianKe == null) {
      return -1;
    }
    return b.thoiGianKe.localeCompare(a.thoiGianKe);
  });
  return orders;
}

async function lookupFromPatientRow(
  patientRow: PatientRow,
  matchCount: number
): Promise<LookupResult> {
  const rows = await fetchMedicationRows(
    String(patientRow.his_patienthistory_id)
  );
  return {
    patient: mapPatient(patientRow),
    orders: groupIntoOrders(rows),
    matchCount
  };
}

export async function lookupByMaHoSo(
  maHoSo: string
): Promise<LookupResult | null> {
  const parsed = parseMaHoSo(maHoSo);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const db = getPool();
  const patientResult = await db.query<PatientRow>(
    `
    SELECT
      his_patienthistory_id,
      name,
      birthday,
      age,
      birthdaystr,
      his_gender,
      his_patientdocument,
      value,
      his_medicalrecordno
    FROM adempiere.his_patienthistory
    WHERE his_patientdocument = $1
      AND isdeleted = 'N'
      AND isactive = 'Y'
    LIMIT 1
    `,
    [parsed.maHoSo]
  );

  const patientRow = patientResult.rows[0];
  if (!patientRow) {
    return null;
  }

  return lookupFromPatientRow(patientRow, 1);
}

/**
 * Lookup by mã bệnh án (his_medicalrecordno).
 * If multiple encounters share the same code, picks the latest by timegoin.
 * Note: no DB index on his_medicalrecordno — may seq-scan (see docs).
 */
export async function lookupByMaBenhAn(
  maBenhAn: string
): Promise<LookupResult | null> {
  const parsed = parseMaBenhAn(maBenhAn);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const db = getPool();
  const patientResult = await db.query<PatientRow & { match_count: string }>(
    `
    SELECT
      his_patienthistory_id,
      name,
      birthday,
      age,
      birthdaystr,
      his_gender,
      his_patientdocument,
      value,
      his_medicalrecordno,
      COUNT(*) OVER() AS match_count
    FROM adempiere.his_patienthistory
    WHERE his_medicalrecordno = $1
      AND isdeleted = 'N'
      AND isactive = 'Y'
    ORDER BY timegoin DESC NULLS LAST, his_patienthistory_id DESC
    LIMIT 1
    `,
    [parsed.maBenhAn]
  );

  const patientRow = patientResult.rows[0];
  if (!patientRow) {
    return null;
  }

  return lookupFromPatientRow(patientRow, Number(patientRow.match_count));
}
