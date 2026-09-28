const form = document.getElementById('lookup-form');
const codeInput = document.getElementById('code-input');
const hint = document.getElementById('hint');
const submitBtn = document.getElementById('submit-btn');
const statusEl = document.getElementById('status');
const patientCard = document.getElementById('patient-card');
const patientDl = document.getElementById('patient-dl');
const ordersCard = document.getElementById('orders-card');
const ordersCount = document.getElementById('orders-count');
const medsTotal = document.getElementById('meds-total');
const ordersList = document.getElementById('orders-list');
const temDialog = document.getElementById('tem-dialog');
const temDialogTitle = document.getElementById('tem-dialog-title');
const temDialogHint = document.getElementById('tem-dialog-hint');
const temDialogList = document.getElementById('tem-dialog-list');
const temPrintAllBtn = document.getElementById('tem-print-all');

const HINT_DEFAULT =
  'Tự nhận: 10 số YYMMDD+STT → mã hồ sơ; còn lại → mã bệnh án.';

/**
 * Same rule as src/db/lookup.parseMaHoSo:
 * 10 digits + valid YYMMDD date prefix → mã hồ sơ; else mã bệnh án.
 */
function detectCodeKind(raw) {
  const code = raw.trim();
  if (!code) {
    return { kind: null, code: '', label: '' };
  }

  if (/^\d{10}$/.test(code)) {
    const mm = Number(code.slice(2, 4));
    const dd = Number(code.slice(4, 6));
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return { kind: 'ma-ho-so', code, label: 'mã hồ sơ' };
    }
  }

  return { kind: 'ma-benh-an', code, label: 'mã bệnh án' };
}

function syncDetectHint() {
  const detected = detectCodeKind(codeInput.value);
  if (!detected.kind) {
    hint.textContent = HINT_DEFAULT;
    return;
  }
  hint.textContent = `Đang nhận là ${detected.label}: ${detected.code}`;
}

codeInput.addEventListener('input', syncDetectHint);
syncDetectHint();

/** Route is injectable if it starts with "Tiêm" and does not contain "truyền". */
function isInjectableRoute(duongDung) {
  if (!duongDung || typeof duongDung !== 'string') {
    return false;
  }
  const name = duongDung.trim();
  if (!/^tiêm/i.test(name)) {
    return false;
  }
  if (/truyền/i.test(name)) {
    return false;
  }
  return true;
}

function injectablesInOrder(order) {
  return (order.medications || []).filter((m) =>
    isInjectableRoute(m.duongDung)
  );
}

function collectInjectableLines(orders) {
  const list = [];
  for (const order of Array.isArray(orders) ? orders : []) {
    for (const med of injectablesInOrder(order)) {
      list.push({ med, toDieuTriId: order.toDieuTriId });
    }
  }
  return list;
}

function setStatus(message, kind) {
  statusEl.hidden = !message;
  statusEl.textContent = message || '';
  statusEl.classList.remove('error', 'ok');
  if (kind) {
    statusEl.classList.add(kind);
  }
}

function formatTime(iso) {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString('vi-VN');
}

function genderLabel(value) {
  if (value === 'M') {
    return 'Nam';
  }
  if (value === 'F') {
    return 'Nữ';
  }
  return value || '—';
}

function renderPatient(patient) {
  const rows = [
    ['Họ tên', patient.tenNb],
    ['Tuổi', patient.tuoi ?? '—'],
    ['Giới tính', genderLabel(patient.gioiTinh)],
    ['Mã hồ sơ', patient.maHoSo],
    ['Mã NB', patient.maNb || '—'],
    ['Mã bệnh án', patient.maBenhAn || '—']
  ];

  patientDl.replaceChildren(
    ...rows.flatMap(([label, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = String(value);
      return [dt, dd];
    })
  );
  patientCard.hidden = false;
}

function medRow(m) {
  const tr = document.createElement('tr');
  if (isInjectableRoute(m.duongDung)) {
    tr.classList.add('row-injectable');
  }

  const cells = [
    m.tenThuoc || '—',
    m.lieuDung || '—',
    m.duongDung || '—',
    m.cachDung || '—',
    m.soLuong ?? '—',
    m.dvt || '—',
    formatTime(m.thoiGianKe)
  ];
  for (const text of cells) {
    const td = document.createElement('td');
    td.textContent = String(text);
    tr.appendChild(td);
  }
  return tr;
}

function buildLabelInnerHtml(patient, med) {
  const tenThuoc = med.tenThuoc || '';
  const tenNb = patient.tenNb || '';
  const tuoi = patient.tuoi != null ? String(patient.tuoi) : '';
  const maBa = patient.maBenhAn || '';

  return `
    <div class="inj-label">
      <div class="inj-label-drug">
        <span class="inj-label-k">Tên thuốc:</span>
        <span class="inj-label-v">${escapeHtml(tenThuoc)}</span>
      </div>
      <div class="inj-label-mix">Thuốc pha:</div>
      <div class="inj-label-patient">
        <span class="inj-label-k">Tên NB:</span>
        <span class="inj-label-v">${escapeHtml(tenNb)}</span>
      </div>
      <div class="inj-label-meta">
        <span>Tuổi: ${escapeHtml(tuoi)}</span>
        <span>Mã BA: ${escapeHtml(maBa)}</span>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const LABEL_PRINT_STYLES = `
  @page { size: 100mm 20mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 100mm;
    margin: 0;
    padding: 0;
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #000;
    background: #fff;
  }
  .tem-row {
    width: 100mm;
    height: 20mm;
    display: flex;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }
  /* Avoid an extra blank label being fed after the last row. */
  .tem-row:last-of-type {
    page-break-after: auto;
    break-after: auto;
  }
  .tem-slot {
    width: 50mm;
    height: 20mm;
    overflow: hidden;
  }
  .inj-label {
    width: 50mm;
    height: 20mm;
    padding: 1mm 1.2mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
  }
  .inj-label-drug {
    font-size: 6pt;
    line-height: 1.15;
    max-height: 2.3em;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    word-break: break-word;
  }
  .inj-label-mix {
    font-size: 5.5pt;
    line-height: 1.2;
    font-weight: 400;
  }
  .inj-label-patient {
    font-size: 6pt;
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .inj-label-k {
    font-weight: 400;
  }
  .inj-label-v {
    font-weight: 700;
  }
  .inj-label-meta {
    display: flex;
    justify-content: space-between;
    gap: 2mm;
    font-size: 5.5pt;
    line-height: 1.2;
    white-space: nowrap;
  }
`;

/** Roll media holds 2 die-cut labels per row, no horizontal gap. */
const TEM_PER_ROW = 2;

function chunkIntoRows(meds) {
  const rows = [];
  for (let i = 0; i < meds.length; i += TEM_PER_ROW) {
    rows.push(meds.slice(i, i + TEM_PER_ROW));
  }
  return rows;
}

/**
 * One printed page = one physical row of the roll.
 * Unused slots stay blank so a phiếu never shares a row with another patient.
 */
function buildRowHtml(patient, rowMeds, { forPreview = false } = {}) {
  let slots = '';
  for (let i = 0; i < TEM_PER_ROW; i += 1) {
    const med = rowMeds[i];
    if (med) {
      slots += `<div class="tem-slot">${buildLabelInnerHtml(patient, med)}</div>`;
    } else {
      slots += `<div class="tem-slot tem-slot-empty">${
        forPreview ? '<span>ô trống</span>' : ''
      }</div>`;
    }
  }
  return `<div class="tem-row">${slots}</div>`;
}

function printTemRows(patient, meds) {
  const list = (meds || []).filter(Boolean);
  if (list.length === 0) {
    return;
  }

  const rowsHtml = chunkIntoRows(list)
    .map((rowMeds) => buildRowHtml(patient, rowMeds))
    .join('');

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(`<!doctype html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Tem thuốc tiêm</title>
  <style>${LABEL_PRINT_STYLES}</style>
</head>
<body>${rowsHtml}</body>
</html>`);
  doc.close();

  const cleanup = () => {
    iframe.remove();
  };

  const win = iframe.contentWindow;
  if (!win) {
    cleanup();
    return;
  }

  win.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 60_000);

  requestAnimationFrame(() => {
    win.focus();
    win.print();
  });
}

function openTemDialog(patient, order) {
  const meds = injectablesInOrder(order);
  const rows = chunkIntoRows(meds);
  const orderLabel = order.toDieuTriId
    ? `Phiếu ${order.toDieuTriId}`
    : 'Không gắn phiếu';

  temDialogTitle.textContent = `${orderLabel} — tem tiêm`;
  temDialogHint.textContent =
    meds.length === 0
      ? 'Phiếu này không có thuốc tiêm thuần (đường dùng bắt đầu «Tiêm», không chứa «truyền»).'
      : `${meds.length} tem · ${rows.length} hàng giấy (${TEM_PER_ROW} ô 50×20 mm mỗi hàng) · xem trước phóng 2×.`;

  temPrintAllBtn.hidden = meds.length === 0;
  temPrintAllBtn.textContent = `In cả phiếu (${meds.length} tem)`;
  temPrintAllBtn.onclick = () => printTemRows(patient, meds);

  temDialogList.replaceChildren();

  rows.forEach((rowMeds, rowIndex) => {
    const card = document.createElement('article');
    card.className = 'label-card';

    const header = document.createElement('header');
    header.className = 'label-card-header';

    const title = document.createElement('p');
    title.className = 'label-card-route';
    title.textContent = `Hàng ${rowIndex + 1} · ${rowMeds.length}/${TEM_PER_ROW} ô`;

    const printRowBtn = document.createElement('button');
    printRowBtn.type = 'button';
    printRowBtn.className = 'btn-print';
    printRowBtn.textContent = 'In hàng';
    printRowBtn.addEventListener('click', () => printTemRows(patient, rowMeds));

    header.append(title, printRowBtn);

    const slot = document.createElement('div');
    slot.className = 'row-preview-slot';
    slot.innerHTML = `<div class="row-preview-scale">${buildRowHtml(
      patient,
      rowMeds,
      { forPreview: true }
    )}</div>`;

    const reprints = document.createElement('div');
    reprints.className = 'row-card-reprints';
    for (const med of rowMeds) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-secondary btn-reprint';
      btn.textContent = `In riêng: ${med.tenThuoc || 'thuốc'}`;
      btn.title = 'In lại một tem — ô còn lại của hàng sẽ để trống';
      btn.addEventListener('click', () => printTemRows(patient, [med]));
      reprints.append(btn);
    }

    card.append(header, slot, reprints);
    temDialogList.append(card);
  });

  if (typeof temDialog.showModal === 'function') {
    temDialog.showModal();
  } else {
    temDialog.setAttribute('open', '');
  }
}

function renderOrders(orders, patient) {
  const list = Array.isArray(orders) ? orders : [];
  const totalLines = list.reduce((sum, o) => sum + (o.medicationCount || 0), 0);

  ordersCount.textContent = `${list.length} phiếu`;
  medsTotal.textContent = `${totalLines} dòng`;

  ordersList.replaceChildren(
    ...list.map((order) => {
      const injectables = injectablesInOrder(order);
      const block = document.createElement('article');
      block.className = 'order-block';

      const header = document.createElement('header');
      header.className = 'order-header';

      const titleRow = document.createElement('div');
      titleRow.className = 'order-title-row';

      const titleBlock = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = order.toDieuTriId
        ? `Phiếu ${order.toDieuTriId}`
        : 'Không gắn phiếu';

      const meta = document.createElement('p');
      meta.className = 'order-meta';
      const injNote =
        injectables.length > 0
          ? ` · ${injectables.length} thuốc tiêm`
          : ' · không có thuốc tiêm';
      meta.textContent = `Kê: ${formatTime(order.thoiGianKe)} · ${order.medicationCount ?? order.medications?.length ?? 0} dòng${injNote}`;
      titleBlock.append(title, meta);

      const printBtn = document.createElement('button');
      printBtn.type = 'button';
      printBtn.className = 'btn-print';
      printBtn.textContent =
        injectables.length > 0 ? `In tem (${injectables.length})` : 'In tem';
      printBtn.disabled = injectables.length === 0;
      printBtn.title =
        injectables.length === 0
          ? 'Phiếu không có thuốc tiêm thuần'
          : 'Mở tem thuốc tiêm của phiếu này';
      printBtn.addEventListener('click', () => openTemDialog(patient, order));

      titleRow.append(titleBlock, printBtn);
      header.append(titleRow);

      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';

      const table = document.createElement('table');
      const thead = document.createElement('thead');
      thead.innerHTML = `
        <tr>
          <th>Tên thuốc</th>
          <th>Liều dùng</th>
          <th>Đường dùng</th>
          <th>Cách dùng</th>
          <th>SL</th>
          <th>ĐVT</th>
          <th>Thời gian kê</th>
        </tr>
      `;
      const tbody = document.createElement('tbody');
      tbody.append(...(order.medications || []).map((m) => medRow(m)));
      table.append(thead, tbody);
      wrap.append(table);

      block.append(header, wrap);
      return block;
    })
  );

  ordersCard.hidden = false;
}

function clearResults() {
  patientCard.hidden = true;
  ordersCard.hidden = true;
  patientDl.replaceChildren();
  ordersList.replaceChildren();
  if (temDialog.open) {
    temDialog.close();
  }
  temDialogList.replaceChildren();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const detected = detectCodeKind(codeInput.value);
  if (!detected.kind) {
    setStatus('Nhập mã hồ sơ hoặc mã bệnh án.', 'error');
    return;
  }

  clearResults();
  setStatus(`Đang tra cứu (${detected.label})…`, null);
  submitBtn.disabled = true;

  const param = detected.kind === 'ma-benh-an' ? 'ma-benh-an' : 'ma-ho-so';

  try {
    const res = await fetch(
      `/api/lookup?${param}=${encodeURIComponent(detected.code)}`
    );
    const body = await res.json();
    if (!res.ok) {
      setStatus(body.error || `Lỗi HTTP ${res.status}`, 'error');
      return;
    }

    renderPatient(body.patient);
    renderOrders(body.orders || [], body.patient);
    const injectCount = collectInjectableLines(body.orders || []).length;
    const matchNote =
      body.matchCount > 1
        ? ` · ${body.matchCount} đợt trùng mã, đã lấy đợt mới nhất`
        : '';
    setStatus(
      `OK (${detected.label}) — ${body.orderCount ?? body.orders?.length ?? 0} phiếu / ${body.medicationCount ?? 0} dòng · ${injectCount} tem tiêm${matchNote}`,
      'ok'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Không gọi được API: ${message}`, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});
