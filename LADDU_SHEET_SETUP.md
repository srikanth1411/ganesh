# Laddu Collection Sheet setup

The configured spreadsheet ID is `1A3Hy8iUAgc53YMvYfMPFz1c9wTnOa5rfhUttGQDPHak`. The complete copy-paste Apps Script is available in `google-apps-script.js`.

The Laddu Collection page expects the Google Apps Script web app to expose two actions:

- `GET ?action=getLadduAuction` — returns the Laddu auction data as `{ status: 'success', data: [...] }`, with the first row as headers.
- `POST action=recordLadduAuction` — records the winning bid and winner signature.
- `POST action=recordLadduPayment` — records each part payment and its signature.

## Auction sheet columns

Create a `Laddu Auction` sheet with these columns. The collection page also accepts the equivalent headings shown in parentheses.

| Timestamp | Name | WhatsApp Number | Laddu Amount | Amount Collected | Auction Photo | Signature |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Winning time | Auction winner's name | 91XXXXXXXXXX | Total auction amount | Total received so far | Winner photo | Winner's signature |

`Auction Amount` can be used instead of `Laddu Amount`. `Paid Amount` can be used instead of `Amount Collected`.

## Payment ledger columns

Create a `Laddu Payments` sheet with this header row:

`Timestamp, Name, WhatsApp Number, Total Laddu Amount, Amount Received, Balance After Payment, Signature`

## Apps Script integration

Add the following branches to the existing deployed Apps Script. Use its existing `SpreadsheetApp.openById(...)` or spreadsheet reference in place of `ss` below. Do not replace unrelated Chanda actions.

```javascript
function doGet(e) {
  const action = e.parameter.action || '';
  if (action === 'getLadduAuction') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const values = ss.getSheetByName('Laddu Auction').getDataRange().getDisplayValues();
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', data: values }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Keep the existing dashboard GET logic here.
}

function doPost(e) {
  const action = e.parameter.action || '';
  if (action === 'recordLadduAuction') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const p = e.parameter;
    ss.getSheetByName('Laddu Auction').appendRow([
      p.Timestamp, p.Name, p['WhatsApp Number'], p['Laddu Amount'],
      p['Amount Collected'], p['Auction Photo'], p.Signature
    ]);
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'recordLadduPayment') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const payment = ss.getSheetByName('Laddu Payments');
    const auction = ss.getSheetByName('Laddu Auction');
    const p = e.parameter;

    payment.appendRow([
      p.Timestamp, p.Name, p['WhatsApp Number'], p['Total Laddu Amount'],
      p['Amount Received'], p['Balance After Payment'], p.Signature
    ]);

    const rows = auction.getDataRange().getValues();
    const headers = rows[0].map(String);
    const phoneColumn = headers.indexOf('WhatsApp Number');
    const collectedColumn = headers.indexOf('Amount Collected');
    const winnerRow = rows.findIndex((row, index) => index > 0 && String(row[phoneColumn]) === String(p['WhatsApp Number']));
    if (winnerRow > 0 && collectedColumn >= 0) {
      auction.getRange(winnerRow + 1, collectedColumn + 1).setValue(
        Number(rows[winnerRow][collectedColumn] || 0) + Number(p['Amount Received'] || 0)
      );
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Keep the existing Chanda POST actions here.
}
```

After saving, deploy a new version of the web app. The URL in `laddu-collection.js` must remain the deployed URL.

> Auction photos and signatures are sent as data URLs. For a production setup, upload them to Google Drive in Apps Script and store the Drive file links in the sheets; this avoids very large spreadsheet cells.
