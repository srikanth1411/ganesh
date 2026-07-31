/*
 * Paste this entire file into your Google Apps Script project, then deploy a
 * new version of the existing Web App deployment.
 */
const SPREADSHEET_ID = '1A3Hy8iUAgc53YMvYfMPFz1c9wTnOa5rfhUttGQDPHak';

const CHANDA_SHEET_NAME = 'Chanda';
const LADDU_AUCTION_SHEET_NAME = 'Laddu Auction';
const LADDU_PAYMENTS_SHEET_NAME = 'Laddu Payments';
const UPLOAD_FOLDER_NAME = 'Ganesh Laddu Records';

function doGet(e) {
  try {
    const action = (e.parameter.action || '').trim();
    const ss = getSpreadsheet_();
    if (action === 'getLadduAuction') {
      const sheet = ensureSheet_(ss, LADDU_AUCTION_SHEET_NAME, ['Timestamp', 'Name', 'WhatsApp Number', 'Laddu Amount', 'Amount Collected', 'Auction Photo', 'Signature']);
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
    const action = (e.parameter.action || '').trim();
    if (action === 'add') addChanda_(e.parameter);
    else if (action === 'updateStatus') updateChandaStatus_(e.parameter);
    else if (action === 'recordLadduAuction') recordLadduAuction_(e.parameter);
    else if (action === 'recordLadduPayment') recordLadduPayment_(e.parameter);
    else throw new Error('Unknown action: ' + action);
    return json_({ status: 'success' });
  } catch (error) {
    return json_({ status: 'error', message: error.message });
  }
}

function addChanda_(data) {
  const sheet = getChandaSheet_(getSpreadsheet_());
  if (sheet.getLastRow() === 0) sheet.appendRow(['Timestamp', 'Name', 'WhatsApp Number', 'Amount', 'Due Date', 'Payment Status']);
  sheet.appendRow([data.Timestamp || new Date().toLocaleString('en-IN'), data.Name || '', data['WhatsApp Number'] || '', Number(data.Amount || 0), data['Due Date'] || '', data['Payment Status'] || 'Paid']);
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
    const sheet = ensureSheet_(getSpreadsheet_(), LADDU_AUCTION_SHEET_NAME, ['Timestamp', 'Name', 'WhatsApp Number', 'Laddu Amount', 'Amount Collected', 'Auction Photo', 'Signature']);
    sheet.appendRow([data.Timestamp || new Date().toLocaleString('en-IN'), data.Name || '', data['WhatsApp Number'] || '', Number(data['Laddu Amount'] || 0), Number(data['Amount Collected'] || 0), saveDataUrl_(data['Auction Photo'], 'auction-photo'), saveDataUrl_(data.Signature, 'auction-signature')]);
  } finally {
    lock.releaseLock();
  }
}

function recordLadduPayment_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = getSpreadsheet_();
    const paymentSheet = ensureSheet_(ss, LADDU_PAYMENTS_SHEET_NAME, ['Timestamp', 'Name', 'WhatsApp Number', 'Total Laddu Amount', 'Amount Received', 'Balance After Payment', 'Signature']);
    const auctionSheet = ensureSheet_(ss, LADDU_AUCTION_SHEET_NAME, ['Timestamp', 'Name', 'WhatsApp Number', 'Laddu Amount', 'Amount Collected', 'Auction Photo', 'Signature']);
    paymentSheet.appendRow([data.Timestamp || new Date().toLocaleString('en-IN'), data.Name || '', data['WhatsApp Number'] || '', Number(data['Total Laddu Amount'] || 0), Number(data['Amount Received'] || 0), Number(data['Balance After Payment'] || 0), saveDataUrl_(data.Signature, 'payment-signature')]);
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
  const folders = DriveApp.getFoldersByName(UPLOAD_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(UPLOAD_FOLDER_NAME);
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
