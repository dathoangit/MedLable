import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attachAccompanyingDrugs,
  groupIntoOrders,
  type MedicationRow
} from './lookup';

function row(
  id: string,
  overrides: Partial<MedicationRow> = {}
): MedicationRow {
  return {
    hisServiceProductId: id,
    toDieuTriId: '100',
    tenThuoc: id,
    lieuDung: null,
    cachDung: null,
    duongDung: 'Tiêm tĩnh mạch',
    thoiGianKe: '2026-09-29T00:00:00.000Z',
    thoiGianThucHien: null,
    soLuong: 1,
    dvt: 'Lọ',
    tocDoTruyen: null,
    donViTocDo: null,
    laThuocDungKem: false,
    thuocDungKem: [],
    unionId: id,
    refUnionId: null,
    ...overrides
  };
}

test('attaches one accompanying drug to its main line', () => {
  const main = row('main', { tenThuoc: 'Omeprazole Normon 40mg' });
  const solvent = row('solvent', {
    tenThuoc: 'Natri Clorid 0,9% - 100ml',
    refUnionId: 'main'
  });

  attachAccompanyingDrugs([main, solvent]);

  assert.equal(main.laThuocDungKem, false);
  assert.deepEqual(main.thuocDungKem, [
    {
      hisServiceProductId: 'solvent',
      tenThuoc: 'Natri Clorid 0,9% - 100ml'
    }
  ]);
  assert.equal(solvent.laThuocDungKem, true);
  assert.deepEqual(solvent.thuocDungKem, []);
});

test('attaches two accompanying drugs, keeping encounter order', () => {
  const main = row('main', { tenThuoc: 'Midazolam' });
  const glucose = row('glucose', {
    tenThuoc: 'Glucose 5%',
    refUnionId: 'main'
  });
  const fentanyl = row('fentanyl', {
    tenThuoc: 'Fentanyl',
    refUnionId: 'main'
  });

  attachAccompanyingDrugs([main, glucose, fentanyl]);

  assert.deepEqual(
    main.thuocDungKem.map((drug) => drug.tenThuoc),
    ['Glucose 5%', 'Fentanyl']
  );
  assert.equal(glucose.laThuocDungKem, true);
  assert.equal(fentanyl.laThuocDungKem, true);
});

test('leaves a line without a reference unchanged', () => {
  const main = row('main');
  attachAccompanyingDrugs([main]);
  assert.equal(main.laThuocDungKem, false);
  assert.deepEqual(main.thuocDungKem, []);
});

test('keeps an orphan reference as a standalone line', () => {
  const orphan = row('orphan', { refUnionId: 'missing' });
  attachAccompanyingDrugs([orphan]);
  assert.equal(orphan.laThuocDungKem, false);
  assert.deepEqual(orphan.thuocDungKem, []);
});

test('copies accompanying flags onto the grouped medication line', () => {
  const main = row('main', { tenThuoc: 'Omeprazole Normon 40mg' });
  const solvent = row('solvent', {
    tenThuoc: 'Natri Clorid 0,9% - 100ml',
    refUnionId: 'main'
  });

  const orders = groupIntoOrders(attachAccompanyingDrugs([main, solvent]));

  assert.equal(orders.length, 1);
  assert.equal(orders[0]?.medicationCount, 2);
  const [mainLine, solventLine] = orders[0]?.medications ?? [];
  assert.equal(mainLine?.laThuocDungKem, false);
  assert.deepEqual(mainLine?.thuocDungKem, [
    {
      hisServiceProductId: 'solvent',
      tenThuoc: 'Natri Clorid 0,9% - 100ml'
    }
  ]);
  assert.equal(solventLine?.laThuocDungKem, true);
  assert.deepEqual(solventLine?.thuocDungKem, []);
});
