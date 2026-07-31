/*
 * Paste this entire file into your Google Apps Script project, then deploy a
 * new version of the existing Web App deployment.
 */
const SPREADSHEET_ID = '1A3Hy8iUAgc53YMvYfMPFz1c9wTnOa5rfhUttGQDPHak';

const CHANDA_SHEET_NAME = 'Chanda';
const LADDU_AUCTION_SHEET_NAME = 'Laddu Auction';
const LADDU_PAYMENTS_SHEET_NAME = 'Laddu Payments';
const SPENDS_SHEET_NAME = 'Spends';
const USERS_SHEET_NAME = 'Users';
const UPLOAD_FOLDER_ID = '1im0n9ooBU_HeEb9tiLVPPPBy3FsiQ63X';

function doGet(e) {
  try {
    const action = (e.parameter.action || '').trim();
    const ss = getSpreadsheet_();
    if (action === 'getLadduAuction') {
      const sheet = ensureSheet_(ss, LADDU_AUCTION_SHEET_NAME, ['Timestamp', 'Name', 'WhatsApp Number', 'Laddu Amount', 'Amount Collected', 'Auction Photo', 'Signature']);
      return json_({ status: 'success', data: sheet.getDataRange().getDisplayValues() });
    }
    if (action === 'getSpends') {
      const sheet = ensureSheet_(ss, SPENDS_SHEET_NAME, ['Date', 'Spend Type', 'Item / Purpose', 'Amount', 'Notes', 'Bill Photo', 'Timestamp']);
      return json_({ status: 'success', data: sheet.getDataRange().getDisplayValues() });
    }
    const sheet = getChandaSheet_(ss);
    return json_({ status: 'success', data: sheet.getDataRange().getDisplayValues() });
  } catch (error) {
    return json_({ status: 'error', message: error.message });
  }
}

function doPost(e) {
  try {
    const data = getRequestData_(e);
    const action = (data.action || '').trim();
    let result = { status: 'success' };
    if (action === 'login') result = login_(data);
    else if (action === 'add') addChanda_(data);
    else if (action === 'updateStatus') updateChandaStatus_(data);
    else if (action === 'recordChandaPayment') recordChandaPayment_(data);
    else if (action === 'recordLadduAuction') recordLadduAuction_(data);
    else if (action === 'recordLadduPayment') recordLadduPayment_(data);
    else if (action === 'recordSpend') recordSpend_(data);
    else throw new Error('Unknown action: ' + action);
    return json_(result);
  } catch (error) {
    return json_({ status: 'error', message: error.message });
  }
}

function getRequestData_(e) {
  const data = {};
  const parameter = e && e.parameter ? e.parameter : {};
  Object.keys(parameter).forEach(key => {
    data[key] = parameter[key];
  });

  if (e && e.postData) {
    const contentType = String(e.postData.type || '').toLowerCase();
    const payload = e.postData.getDataAsString ? e.postData.getDataAsString() : String(e.postData.contents || '');
    if (!payload) return data;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const parsed = payload.split('&').reduce((acc, entry) => {
        if (!entry) return acc;
        const [rawKey, ...rawValueParts] = entry.split('=');
        const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
        const value = decodeURIComponent((rawValueParts.join('=') || '').replace(/\+/g, ' '));
        acc[key] = value;
        return acc;
      }, {});
      Object.keys(parsed).forEach(key => {
        data[key] = parsed[key];
      });
      return data;
    }

    if (contentType.includes('multipart/form-data')) {
      const boundary = contentType.split('boundary=')[1];
      if (!boundary) return data;
      const boundaryMarker = `--${boundary}`;
      const parts = payload.split(boundaryMarker).filter(part => part && part.trim() !== '--' && part.trim() !== '');
      parts.forEach(part => {
        const lines = part.split(/\r\n|\n/);
        const headerLine = lines.find(line => line.includes('name='));
        if (!headerLine) return;
        const nameMatch = headerLine.match(/name="([^"]+)"/);
        const name = nameMatch ? nameMatch[1] : '';
        if (!name) return;
        const value = lines.slice(2).join('\n').trim();
        if (value) data[name] = value;
      });
      return data;
    }
  }

  return data;
}

function addChanda_(data) {
  const sheet = getChandaSheet_(getSpreadsheet_());
  if (sheet.getLastRow() === 0) sheet.appendRow(['Timestamp', 'Name', 'WhatsApp Number', 'Amount', 'Due Date', 'Payment Status', 'Amount Collected']);
  sheet.appendRow([data.Timestamp || new Date().toLocaleString('en-IN'), data.Name || '', data['WhatsApp Number'] || '', Number(data.Amount || 0), data['Due Date'] || '', data['Payment Status'] || 'Paid', data['Payment Status'] === 'Paid' ? Number(data.Amount || 0) : 0]);
}

function login_(data) {
  const sheet = ensureSheet_(getSpreadsheet_(), USERS_SHEET_NAME, ['Name', 'PIN', 'Role', 'Active']);
  seedDefaultUser_(sheet);
  const rows = sheet.getDataRange().getDisplayValues();
  const name = String(data.Name || '').trim();
  const pin = String(data.PIN || '');
  const match = rows.slice(1).find(row => row[0].trim().toLowerCase() === name.toLowerCase() && row[1] === pin && String(row[3]).toLowerCase() !== 'no');
  if (!match) throw new Error('Invalid staff name or PIN.');
  return { status: 'success', user: { name: match[0], role: match[2] || 'Staff' } };
}

function seedDefaultUser_(sheet) {
  const rows = sheet.getDataRange().getDisplayValues();
  const alreadyExists = rows.slice(1).some(row => String(row[0] || '').trim().toLowerCase() === 'srikanth');
  if (alreadyExists) return;
  sheet.appendRow(['srikanth', 'chintu&1411', 'Staff', 'Yes']);
}

function requireStaff_(data) {
  const name = String(data['Updated By'] || '').trim();
  const sheet = ensureSheet_(getSpreadsheet_(), USERS_SHEET_NAME, ['Name', 'PIN', 'Role', 'Active']);
  const allowed = sheet.getDataRange().getDisplayValues().slice(1).some(row => row[0].trim().toLowerCase() === name.toLowerCase() && String(row[3]).toLowerCase() !== 'no');
  if (!allowed) throw new Error('Please log in before recording this action.');
  return name;
}

function recordChandaPayment_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getChandaSheet_(getSpreadsheet_());
    ensureColumns_(sheet, ['Amount Collected']);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const phoneColumn = findColumn_(headers, ['WhatsApp Number', 'Mobile Number', 'Phone']);
    const amountColumn = findColumn_(headers, ['Amount', 'Total Amount', 'Chanda Amount']);
    const collectedColumn = findColumn_(headers, ['Amount Collected', 'Collected Amount']);
    const statusColumn = findColumn_(headers, ['Payment Status', 'Status']);
    const rows = sheet.getDataRange().getValues();
    const phone = String(data['WhatsApp Number'] || '');
    const rowIndex = rows.findIndex((row, index) => index > 0 && String(row[phoneColumn - 1]) === phone);
    if (rowIndex < 1) throw new Error('Chanda record was not found for this mobile number.');
    const current = Number(rows[rowIndex][collectedColumn - 1]) || 0;
    const received = Number(data['Amount Received']) || 0;
    const total = Number(rows[rowIndex][amountColumn - 1]) || 0;
    const updated = current + received;
    sheet.getRange(rowIndex + 1, collectedColumn).setValue(updated);
    if (statusColumn) sheet.getRange(rowIndex + 1, statusColumn).setValue(updated >= total ? 'Paid' : 'Pending');
  } finally {
    lock.releaseLock();
  }
}

function updateChandaStatus_(data) {
  const sheet = getChandaSheet_(getSpreadsheet_());
  const rowNumber = Number(data.rowNumber);
  if (!rowNumber || rowNumber < 2) throw new Error('Invalid Chanda row number.');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const statusColumn = findColumn_(headers, ['Payment Status', 'Status']);
  if (!statusColumn) throw new Error('Payment Status column was not found.');
  sheet.getRange(rowNumber, statusColumn).setValue(data.status || 'Paid');
}

function recordLadduAuction_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const staff = requireStaff_(data);
    const sheet = ensureSheet_(getSpreadsheet_(), LADDU_AUCTION_SHEET_NAME, ['Timestamp', 'Name', 'WhatsApp Number', 'Laddu Amount', 'Amount Collected', 'Auction Photo', 'Signature', 'Updated By']);
    ensureColumns_(sheet, ['Updated By']);
    sheet.appendRow([data.Timestamp || new Date().toLocaleString('en-IN'), data.Name || '', data['WhatsApp Number'] || '', Number(data['Laddu Amount'] || 0), Number(data['Amount Collected'] || 0), saveDataUrl_(data['Auction Photo'], 'auction-photo'), saveDataUrl_(data.Signature, 'auction-signature'), staff]);
  } finally {
    lock.releaseLock();
  }
}

function recordLadduPayment_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const staff = requireStaff_(data);
    const ss = getSpreadsheet_();
    const paymentSheet = ensureSheet_(ss, LADDU_PAYMENTS_SHEET_NAME, ['Timestamp', 'Name', 'WhatsApp Number', 'Total Laddu Amount', 'Amount Received', 'Balance After Payment', 'Signature']);
    const auctionSheet = ensureSheet_(ss, LADDU_AUCTION_SHEET_NAME, ['Timestamp', 'Name', 'WhatsApp Number', 'Laddu Amount', 'Amount Collected', 'Auction Photo', 'Signature']);
    ensureColumns_(paymentSheet, ['Updated By']);
    paymentSheet.appendRow([data.Timestamp || new Date().toLocaleString('en-IN'), data.Name || '', data['WhatsApp Number'] || '', Number(data['Total Laddu Amount'] || 0), Number(data['Amount Received'] || 0), Number(data['Balance After Payment'] || 0), saveDataUrl_(data.Signature, 'payment-signature'), staff]);
    const headers = auctionSheet.getRange(1, 1, 1, auctionSheet.getLastColumn()).getValues()[0];
    const phoneColumn = findColumn_(headers, ['WhatsApp Number', 'Mobile Number', 'Phone']);
    const collectedColumn = findColumn_(headers, ['Amount Collected', 'Collected Amount']);
    if (!phoneColumn || !collectedColumn) throw new Error('Laddu Auction sheet requires WhatsApp Number and Amount Collected columns.');
    const rows = auctionSheet.getDataRange().getValues();
    const phone = String(data['WhatsApp Number'] || '');
    for (let index = 1; index < rows.length; index++) {
      if (String(rows[index][phoneColumn - 1]) === phone) {
        auctionSheet.getRange(index + 1, collectedColumn).setValue((Number(rows[index][collectedColumn - 1]) || 0) + (Number(data['Amount Received']) || 0));
        return;
      }
    }
    throw new Error('Auction winner was not found for this mobile number.');
  } finally {
    lock.releaseLock();
  }
}

function recordSpend_(data) {
  const staff = requireStaff_(data);
  const sheet = ensureSheet_(getSpreadsheet_(), SPENDS_SHEET_NAME, ['Date', 'Spend Type', 'Item / Purpose', 'Amount', 'Notes', 'Bill Photo', 'Timestamp', 'Updated By']);
  ensureColumns_(sheet, ['Bill Photo', 'Updated By']);
  sheet.appendRow([
    data.Date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    data['Spend Type'] || 'Other',
    data['Item / Purpose'] || '',
    Number(data.Amount || 0),
    data.Notes || '',
    saveDataUrl_(data['Bill Photo'], 'spend-bill'),
    data.Timestamp || new Date().toLocaleString('en-IN'), staff
  ]);
}

function getSpreadsheet_() { return SpreadsheetApp.openById(SPREADSHEET_ID); }

function getChandaSheet_(ss) {
  const named = ss.getSheetByName(CHANDA_SHEET_NAME);
  if (named) return named;
  const first = ss.getSheets()[0];
  if (first.getName() !== LADDU_AUCTION_SHEET_NAME && first.getName() !== LADDU_PAYMENTS_SHEET_NAME) return first;
  return ensureSheet_(ss, CHANDA_SHEET_NAME, ['Timestamp', 'Name', 'WhatsApp Number', 'Amount', 'Due Date', 'Payment Status']);
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) { sheet.appendRow(headers); sheet.setFrozenRows(1); }
  return sheet;
}

function ensureColumns_(sheet, columnNames) {
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  columnNames.forEach(name => {
    if (!findColumn_(headers, [name])) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(name);
      headers.push(name);
    }
  });
}

function findColumn_(headers, candidates) {
  const normalized = headers.map(header => String(header).trim().toLowerCase());
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate.toLowerCase());
    if (index !== -1) return index + 1;
  }
  return 0;
}

function saveDataUrl_(dataUrl, prefix) {
  if (!dataUrl || !String(dataUrl).startsWith('data:')) return '';
  const parts = String(dataUrl).match(/^data:(.+);base64,(.+)$/);
  if (!parts) return '';
  const extension = parts[1].includes('png') ? 'png' : 'jpg';
  const file = getUploadFolder_().createFile(Utilities.newBlob(Utilities.base64Decode(parts[2]), parts[1], `${prefix}-${new Date().getTime()}.${extension}`));
  return file.getUrl();
}

function getUploadFolder_() {
  return DriveApp.getFolderById(UPLOAD_FOLDER_ID);
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
