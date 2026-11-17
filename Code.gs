// Replace your Apps Script code with this version.
// It supports both normal JSON and JSONP so the browser scanner can read it
// despite Google Apps Script's cross-origin redirect behavior.

const SPREADSHEET_ID = "1Rv4fyxwKnA-TS77cFlt0YGdCELaVeaN3axpwjV0yFs8";
const SHEET_NAME = "products";

function doGet(e) {
  let result;
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Sheet tab 'products' was not found.");

    const values = sheet.getDataRange().getValues();
    if (!values.length) {
      result = { success: true, products: [], totalProducts: 0 };
    } else {
      const headers = values[0].map(h => String(h).trim().toLowerCase());
      const nameIndex = headers.indexOf("name");
      const mrpIndex = headers.indexOf("mrp");
      const dpIndex = headers.indexOf("dp");
      const pvIndex = headers.indexOf("pv");
      if ([nameIndex, mrpIndex, dpIndex, pvIndex].includes(-1)) {
        throw new Error("Required columns missing. Found: " + headers.join(", "));
      }
      const products = values.slice(1)
        .filter(row => String(row[nameIndex] ?? "").trim() !== "")
        .map(row => ({
          name: String(row[nameIndex]).trim(),
          MRP: row[mrpIndex],
          DP: row[dpIndex],
          pv: row[pvIndex]
        }));
      result = { success: true, totalProducts: products.length, products: products };
    }
  } catch (err) {
    result = { success: false, error: String(err && err.message ? err.message : err) };
  }

  const callback = e && e.parameter ? e.parameter.callback : "";
  if (callback) {
    // Accept only a simple JavaScript identifier to prevent script injection.
    if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
      return ContentService.createTextOutput("Invalid callback")
        .setMimeType(ContentService.MimeType.TEXT);
    }
    return ContentService.createTextOutput(callback + "(" + JSON.stringify(result) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
