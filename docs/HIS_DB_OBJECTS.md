# HIS key objects — column inventory

Schema: `adempiere`. Captured 2026-09-23.  
Row counts are approximate snapshots.  
The columns the API actually reads are in [HIS_DB_MEDLABEL.md](HIS_DB_MEDLABEL.md). This file is the wider inventory.

## Tables

### `his_patient` (~1.12M)

`his_patient_id`, `ad_client_id`, `ad_org_id`, `created`, `createdby`, `his_patient_uu`, `isactive`, `isdeleted`, `name`, `updated`, `updatedby`, `value`, `address2`, `combineinfo`, `his_gender`, `birthday`, `tel_no`, `combineinfo2`, `id_no`, `assurancenumber`, `isofhcareaccount`, `isofhcarepassword`, `imgurl`

Unique index: `his_patient_value (value)`.

### `his_patienthistory` (~3.45M)

Encounter / đợt điều trị. Large table (~300 columns). MedLabel subset:

`his_patienthistory_id`, `value`, `name`, `birthday`, `birthdaystr`, `his_gender`, `age`, `scancode`, `his_patientdocument`, `his_patienttracking`, `his_medicalrecordno`, `his_outmedicalrecordno`, `his_department_id`, `inhospital_department_id`, `his_room_id`, `his_bed_id`, `isinpatient`, `ispatientinhospital`, `patientstate`, `timegoin`, `timegoout`, `regdate`, `isemergency`, `isdeleted`, `isactive`, `his_reception_id`, `assurancenumber`, `id_no`, `tel_no`, `address1`, `address2`, `detailaddress`, `discharge_diagnostic`, `first_diagnostic`, …

Indexes: `hph_value`, unique `hph_patientdocument`, `hph_name`, `hph_timegoin`, `hph_departmentid`, …

### `his_service_product` (~42.6M)

Core medication/service product lines. Selected columns:

`his_service_product_id`, `his_service_product_uu`, `his_patienthistory_id`, `patientname`, `patientvalue`, `his_patientdocument`, `his_patienttracking`, `his_service_id`, `servicename`, `value`, `originalvalue`, `his_dosage_id`, `his_methoduse_id`, `his_usage`, `quantity`, `requestedquantity`, `returnedquantity`, `acceptedquantity`, `c_uom_id`, `transferrate`, `transferunit`, `usedhour`, `fromhour`, `tohour`, `timesperday`, `numberofday`, `useddayquantity`, `period`, `docdate`, `actdate`, `isinpatient`, `isdrugstore`, `isserviceused`, `isnotcounted`, `isadditional`, `isunforeseen`, `isreference`, `ref_service_union_id`, `his_service_union_id`, `his_storage_id`, `his_storage_document_id`, `batchdist_storage_doc_id`, `his_storage_summary_id`, `his_product_import_id`, `his_producttype_id`, `from_department_id`, `from_doctor_id`, `his_medicalrecordno`, `his_patient_bed_id`, `his_patient_evolution_id`, `createdfromrecord_id`, `createdfromservicetype`, `his_servicetype`, `status`, `note`, `seqno`, `amount`, `unitprice_*`, `isdeleted`, `isactive`, `iscompleted`, …

Indexes: `hsp_patienthistoryid`, `hsp_actdate`, `hsp_storagedocumenetid`, `hsp_batchdiststoragedocid`, unique `hsp_serviceunionid`, …

### `his_product` (~26.8k)

`his_product_id`, `value`, `name`, `originalname`, `originalvalue`, `valuemedicine`, `his_service_id`, `his_producttype_id`, `his_productgroup_id`, `his_methoduse_id`, `his_activeingredient_id`, `his_activeingredient`, `c_uom_id`, `primary_uom_id`, `secondary_uom_id`, `his_packing`, `his_measure`, `dosage_form`, `infusionvolume`, `volume`, `isdosage`, `warning`, `drugeffect`, `unitprice_service`, `unitprice_assurance`, `his_manufacturer_id`, `his_country_id`, `his_supplier_id`, `isdeleted`, `isactive`, …

### `his_prescription` (~2.93M)

`his_prescription_id`, `value`, `his_patienthistory_id`, `his_storage_document_id`, `resultinfo`, `isdeleted`, `isactive`, …

Index: `his_prescription_patienthistory`.

### `his_storage_document` (~20.3M)

Inventory / dispense documents. Selected: `his_storage_document_id`, `documentno`, `prescriptionno`, `his_patienthistory_id`, `patientname`, `patientvalue`, `his_storage_id`, `tostorage_id`, `his_servicetype`, `docdate`, `isverified`, `iscompleted`, `isdrugstore`, `isdistributed`, `from_department_id`, `from_doctor_id`, `his_medicalrecordno`, `seqnomedicine`, `sortprescriptionno`, …

### `his_storage_documentline` (~6.4M)

`his_storage_documentline_id`, `his_storage_document_id`, `his_patienthistory_id`, `his_service_id`, `his_product_import_id`, `quantity`, `requestedquantity`, `servicename`, `value`, `his_storage_id`, `c_uom_id`, …

### `his_storage` (~702)

Warehouses / drug cabinets: `his_storage_id`, `value`, `name`, `isdrugstore`, `his_department_id`, `belongtodepartment_id`, …

### `his_dosage` (~816)

`his_dosage_id`, `value`, `name`, `timesperday`, `pillspertime`, `isinpatient`, …

### `his_methoduse` (64)

`his_methoduse_id`, `value`, `name`, `priority`, …

### `his_product_dosage` (~326)

`his_product_dosage_id`, `his_dosage_id`, `his_service_id`, `isinpatient`, `isoutpatient`, `priority`, …

### `his_producttype` (23)

See [HIS_DB_CATALOG.md](HIS_DB_CATALOG.md).

### `his_danhmuc_thuoc` (~797)

`ma_thuoc`, `ten_thuoc`, `ten_hoat_chat`, `don_vi_tinh`, `ham_luong`, `duong_dung`, `ma_duong_dung`, `so_dang_ky`, `quy_cach`, `nha_sx`, `nuoc_sx`, `loai_thuoc`, `his_service_id`, …

### `his_reception`

Registration; includes `scancode`, `his_patienthistory_id`, demographics (large column set).

### `his_qrcode`

Payment/QR artifacts — not clinical wristband codes.

### `his_doctoradvice` (3)

Template advice texts (`contenttext`, `isformedicine`) — not per-order.

## Views (medication / y lệnh)

| View                                   | Purpose                                           |
| -------------------------------------- | ------------------------------------------------- |
| `nb_phieu_thuc_hien_y_lenh_thuoc`      | Medication execution slip (VN columns)            |
| `nb_phieu_thuc_hien_y_lenh`            | Generic execution slip                            |
| `nb_phieu_thuc_hien_y_lenh_vat_tu`     | Supplies                                          |
| `nb_phieu_thuc_hien_y_lenh_xn_cdha`    | Lab/imaging                                       |
| `nb_to_dieu_tri`                       | Treatment sheet header                            |
| `nb_ngay_y_lenh`                       | Order dates                                       |
| `his_rv_y_lenh_product`                | Y lệnh product lines                              |
| `his_rv_medical_product`               | Medical product lines                             |
| `his_rv_medical_ylenh`                 | Medical y lệnh summary                            |
| `his_rv_medical_ylenh_surgery`         | Surgery variant                                   |
| `his_rv_donthuoc*`                     | Prescription report views                         |
| `his_hsba_medicine`                    | HSBA medicine projection of `his_service_product` |
| `to_dieu_tri` / `his_rv_to_dieu_tri_*` | Treatment-sheet report variants                   |

### `his_rv_y_lenh_product` columns

`his_patienthistory_id`, `patientname`, `priority`, `seqno`, `useddayquantity`, `docdate`, `his_medicalrecordline_id`, `actdate`, `ishasreference`, `isdrugstore`, `isserviceused`, `originalname`, `servicename`, `his_measure`, `isverified`, `requestedquantity`, `quantity`, `uomname`, `isunforeseen`, `isadditional`, `methoduse`, `his_dosage`, `his_usage`, `transferrate`, `transferunit`, `transferunit_trl`, `usedhour`, `istrackingusingday`, `his_servicetype`, `his_storage_document_id`, `his_storage_id`, `from_department_id`, `jasperreport`, `giotich`, `referenceservicename`

### `nb_phieu_thuc_hien_y_lenh_thuoc` columns

`created_at`, `updated_at`, `created_by`, `updated_by`, `active`, `deleted`, `id`, `nb_dot_dieu_tri_id`, `nb_to_dieu_tri_id`, `dich_vu_id`, `ma_dich_vu`, `ten_dich_vu`, `so_luong_yeu_cau`, `so_luong`, `thoi_gian_chi_dinh`, `thoi_gian_thuc_hien`, `nha_thuoc`, `uu_tien`, `so_ngay_dung`, `thuoc_dung_kem`, `thuoc_dung_kem_id`, `tu_tuc`, `khong_tinh_tien`, `ten_duong_dung`, `ten_cach_dung`, `lieu_dung`, `toc_do_truyen`, `don_vi_toc_do_truyen`, `ten_don_vi_tinh`, `dot_suat`, `bo_sung`, `so_ngay_su_dung`, `da_phat`

## Foreign keys

PostgreSQL `information_schema` reported **no FK constraints** on the core HIS tables inspected (`his_service_product`, `his_prescription`, `his_product`, …). Relationships are enforced in the application layer — join on `*_id` columns by convention.
