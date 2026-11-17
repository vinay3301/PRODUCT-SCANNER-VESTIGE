# Product Scanner — phone-only setup

This is a first working prototype for Android Chrome. It uses camera text recognition (OCR) to read product packaging and matches the text against your Google Sheet API. It is an AR-style screen overlay, not 3D object tracking.

## 1) Update Apps Script for browser access

The scanner uses JSONP because Apps Script may redirect its response and ordinary browser `fetch()` can be blocked by cross-origin restrictions.

1. Open the Apps Script project that owns your `products` sheet.
2. Replace its code with the contents of `Code.gs` in this folder.
3. Save.
4. Deploy → Manage deployments → Edit (pencil) → New version → Deploy.
5. Keep **Execute as: Me** and **Who has access: Anyone**.
6. Use the new `/exec` URL. If Google creates a different URL, update `API_URL` in `index.html` to that new URL.
7. Test the endpoint in a browser by adding `?callback=testCallback` to the URL. The response should begin with `testCallback(` and contain `"success":true`.

Anyone who has the public API URL can read the product names and prices. Do not put private information in this sheet.

## 2) Host the scanner from your Android phone

The camera requires HTTPS. Do not open `index.html` as a local file.

A simple phone-only route is GitHub Pages:

1. In Chrome, create/sign in to a GitHub account.
2. Create a new public repository, for example `product-scanner`.
3. Upload `index.html`, `manifest.webmanifest`, and `sw.js` from this folder.
4. In repository Settings → Pages, choose deploy from branch `main`, folder `/root`, then Save.
5. Wait for the Pages URL shown there. Open that URL in Android Chrome.
6. Use Chrome menu → Add to Home screen / Install app.

A public GitHub repository makes the app source visible. It does not expose your Google account password. Your product API is already public by design.

## 3) How to use

1. Open the HTTPS app URL.
2. Allow camera access.
3. Tap Start camera.
4. Hold the product name and pack size inside the green frame in good light.
5. Wait for OCR to read the label. If multiple products look similar, select the correct match.

## Limitations of this prototype

- OCR accuracy depends on lighting, focus, label curvature, fonts, and language. The initial version recognizes English text.
- Product matching is based on name text. If your sheet contains near-duplicate names, the app asks you to choose rather than silently deciding.
- This is a 2D overlay and does not lock a floating label to a physical object in 3D.
- Tesseract.js and its language data are loaded from a CDN, so internet access is required.
- It currently displays MRP, DP, and PV from the sheet. It does not yet use the supplied product-image PDF for visual recognition.
- Test with a small set of products before sharing widely.
