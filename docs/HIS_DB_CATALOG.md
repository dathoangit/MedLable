# HIS catalog reference (MedLabel)

Static reference lists from `adempiere` (2026-09-23). Soft-deleted rows excluded where noted.

## Administration routes — `his_methoduse`

Injection / infusion related (value prefix `2.*` plus “Truyền”):

| id | value | name |
|----|-------|------|
| 1000057 | 2.01 | Tiêm bắp |
| 1000004 | 2.02 | Tiêm dưới da |
| 1000005 | 2.03 | Tiêm trong da |
| 1000006 | 2.04 | Tiêm tĩnh mạch |
| 1000007 | 2.05 | Tiêm truyền tĩnh mạch |
| 1000058 | 2.06 | Tiêm vào ổ khớp |
| 1000008 | 2.07 | Tiêm nội nhãn cầu |
| 1000009 | 2.08 | Tiêm trong dịch kính của mắt |
| 1000010 | 2.09 | Tiêm vào các khoang của cơ thể |
| 1000011 | 2.10 | Tiêm |
| 1000012 | 2.11 | Tiêm động mạch khối u |
| 1000013 | 2.12 | Tiêm vào khoang tự nhiên |
| 1000014 | 2.13 | Tiêm vào khối u |
| 1000015 | 2.14 | Truyền tĩnh mạch |
| 1000016 | 2.15 | Tiêm truyền |
| 1000061 | 2.16 | Truyền |
| 1000062 | 2.17 | Thủy châm |

Other common routes (full table has 64 rows): Uống, Ngậm, Bôi, Xịt, Khí dung, Nhỏ mắt/mũi/tai, Đặt, Thụt, …

**Suggested MedLabel filter:** `his_methoduse_id IN (...)` using the injection/infusion set above, or `name ~* '(tiêm|truyền)'`.

## Product types — `his_producttype`

| id | value | name |
|----|-------|------|
| 1000000 | 07 | Dịch truyền |
| 1000013 | 08 | Dịch truyền thường |
| 1000014 | 09 | Dịch truyền đạm |
| 1000001 | 01 | Gây nghiện |
| 1000002 | 02 | Hướng thần |
| 1000008 | 03 | Thuốc độc |
| 1000011 | 04 | Thuốc phối hợp - Gây Nghiện-Hướng thần |
| 1000012 | 05 | Kháng sinh |
| 1000003 | 06 | Thuốc thường |
| 1000015 | 10 | Thuốc bị cấm SD trong một số ngành |
| 1000016 | 11 | Thuốc bị cấm SD trong một số ngành-KS |
| 1000017 | 12 | Thuốc y học cổ truyền |
| 1000018 | 13 | Vitamin |
| 1000019 | 14 | Nhóm thuốc dùng ngoài |
| 1000020 | 15 | Nhóm thuốc pha chế |
| 1000006 | 16 | Hóa chất |
| 1000007 | 17 | Thực phẩm chức năng |
| 1000010 | 18 | Nghiên cứu khoa học |
| 1000009 | 19 | Máu |
| 1000004 | 20 | Vật tư tiêu hao |
| 1000005 | 21 | Thuốc ngoài danh mục |
| 1000021 | 22 | Trang thiết bị |
| 1000022 | 23 | Hóa mỹ phẩm |

Infusion fluids: types **07 / 08 / 09**. Can combine with route filter for bag labels.

## Infusion rate units — AD reference `TransferUnit`

| value | name |
|-------|------|
| `ml/h` | ml/h |
| `d/m` | d/m (drops per minute) |

Stored on `his_service_product.transferunit`; display via `get_reference_value('TransferUnit', ...)`.

## Dosage — `his_dosage`

~816 rows. `name` is free-text instruction (e.g. “Bôi ngày 2 lần”, “120g/phút”, multi-week regimens).  
Optional structured fields: `timesperday`, `pillspertime`, `isinpatient`.

Linked to products via `his_product_dosage` (`his_service_id` + `his_dosage_id`).

Order lines also store free text in `his_service_product.his_usage` (exposed as `lieu_dung` in nursing views).

## Drug catalog — `his_product`

~27k products; ~21.7k with `his_service_id` set (join key to `his_service_product.his_service_id`).

Notable fields:

- `name`, `originalname`, `value`, `valuemedicine`
- `his_activeingredient` / `his_activeingredient_id`
- `dosage_form`, `his_measure`, `his_packing`, `volume`
- `infusionvolume` (numeric)
- `his_methoduse_id` (default route)
- `isdosage`, `warning`, `drugeffect`
- `his_producttype_id`

BHYT-oriented catalog: `his_danhmuc_thuoc` (~800) with `ma_thuoc`, `ten_thuoc`, `ten_hoat_chat`, `duong_dung`, `ham_luong`, `don_vi_tinh`.

## Nursing view column glossary — `nb_phieu_thuc_hien_y_lenh_thuoc`

| View column | Source |
|-------------|--------|
| `nb_dot_dieu_tri_id` | `his_service_product.his_patienthistory_id` |
| `nb_to_dieu_tri_id` | `createdfromrecord_id` (treatment sheet line) |
| `dich_vu_id` | `his_service_id` |
| `ma_dich_vu` / `ten_dich_vu` | `his_product.value` / `name` |
| `so_luong_yeu_cau` / `so_luong` | requested / actual qty |
| `thoi_gian_chi_dinh` / `thoi_gian_thuc_hien` | `docdate` / `actdate` |
| `nha_thuoc` | `isdrugstore` |
| `ten_duong_dung` | `his_methoduse.name` |
| `ten_cach_dung` | `his_dosage.name` |
| `lieu_dung` | `his_usage` |
| `toc_do_truyen` | `transferrate` |
| `don_vi_toc_do_truyen` | TransferUnit translation |
| `ten_don_vi_tinh` | `c_uom.name` |
| `da_phat` | storage document `isverified` |
| `thuoc_dung_kem` | `isreference` (companion drug) |

## Treatment sheet view — `nb_to_dieu_tri`

Patient/day clinical sheet fields (`ma_ho_so`, `ma_nb`, `ten_nb`, diagnoses, vitals). Useful for header context on a label sheet, not for per-syringe drug lines.
