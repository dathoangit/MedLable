/**
 * Lookup API v1 — the contract shared with the MedLabel Chrome extension.
 *
 * This file must not import anything. The extension copies it via
 * `yarn sync:contract`. Breaking changes require a new version file.
 */

export const LOOKUP_API_VERSION = 1 as const;

export type LookupApiVersion = typeof LOOKUP_API_VERSION;

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

/** A solvent or co-drug mixed into a main medication line. */
export type AccompanyingDrug = {
  hisServiceProductId: string;
  tenThuoc: string | null;
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
  /** True when this line is a solvent or co-drug attached to another line. */
  laThuocDungKem: boolean;
  /** Solvents / co-drugs mixed into this line. Empty for most lines. */
  thuocDungKem: AccompanyingDrug[];
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

export type LookupBy = 'maHoSo' | 'maBenhAn';

export type LookupSuccessResponse = LookupResult & {
  apiVersion: LookupApiVersion;
  lookupBy: LookupBy;
  /** Present when lookupBy is maHoSo (YYMMDD parsed from the code). */
  dateHint?: string;
  orderCount: number;
  medicationCount: number;
};

export type ApiErrorCode =
  'VALIDATION' | 'NOT_FOUND' | 'RATE_LIMIT' | 'INTERNAL';

export type LookupErrorResponse = {
  apiVersion: LookupApiVersion;
  error: string;
  code: ApiErrorCode;
};

export type HealthResponse = {
  ok: boolean;
  apiVersion: LookupApiVersion;
  service: 'medlabel';
  db: 'up' | 'down';
};
