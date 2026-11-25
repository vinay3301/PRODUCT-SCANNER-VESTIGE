# Product Scanner Vestige

A mobile-friendly, browser-based product scanner and dealer inventory/sales tool for Vestige products. The app combines camera-based OCR product identification with local stock management, stock-in records, Actual Sale and Record Sale workflows, transaction history, and JSON backup/restore.

- **Live app:** https://vinay3301.github.io/PRODUCT-SCANNER-VESTIGE/
- **Source repository:** https://github.com/vinay3301/PRODUCT-SCANNER-VESTIGE
- **Main application:** `index.html`
- **Product data API:** `https://vestige-products-api.vinaykinnera3301.workers.dev/`

> **Important data note:** Inventory, stock-in history, sales history, and the active cart are stored in the browser on the device/profile where the app is used. They are not automatically synchronized to Google Drive, a server, or another device. Export a backup regularly, especially before clearing browser data or changing devices.

---

## Contents

1. [What the app does](#what-the-app-does)
2. [Application layout](#application-layout)
3. [Complete button and control guide](#complete-button-and-control-guide)
4. [Stock workflow](#stock-workflow)
5. [Selling workflow](#selling-workflow)
6. [Cart quantities, free products, and totals](#cart-quantities-free-products-and-totals)
7. [History lists and scrolling](#history-lists-and-scrolling)
8. [Backup and restore](#backup-and-restore)
9. [Product scanning and matching](#product-scanning-and-matching)
10. [Data storage and business rules](#data-storage-and-business-rules)
11. [Technical architecture](#technical-architecture)
12. [Testing and maintenance](#testing-and-maintenance)
13. [Troubleshooting](#troubleshooting)

---

## What the app does

The app has two connected purposes:

### Product identification
- Reads a Vestige product label using the device camera.
- Uses multi-pass OCR and image processing to recognize printed product names.
- Compares OCR text with the product catalogue and presents likely matches.
- Displays the selected product's **MRP**, **DP**, and **PV / Points**.
- Adds the selected product to the current Stock-in Cart or Sale Cart, depending on the active workflow.

### Dealer stock and sales management
- Records stock received and increases available inventory.
- Shows current stock value using DP and PV.
- Allows manual stock quantity adjustments.
- Supports **Actual Sale** and **Record Sale**.
- Calculates sale amount and PV, including free quantities.
- Tracks stock-in history and sale history.
- Exports and imports a complete JSON business-data backup.

The interface is designed for mobile use but can also be opened in a desktop browser. Camera access requires a supported browser and a secure HTTPS page.

---

## Application layout

The page is arranged in the following order:

1. Header, theme switch, and product API status.
2. Camera preview and scanning frame.
3. Camera controls and scan status.
4. Selected product details and OCR match suggestions.
5. **Stock / Selling** mode switch.
6. The stock-management panel when Stock mode is active.
7. The Stock-in Cart or Sale Cart.
8. Sale controls and Sale History when Selling mode is active.
9. Backup export/import panel.

The app starts in **Stock** mode. The same cart area is reused for stock-in and sales; its title, fields, and checkout action change with the active workflow.

---

## Complete button and control guide

This section describes the controls currently present in the application. Some controls are created dynamically by JavaScript when the relevant mode or result is displayed.

### Header and theme

| Button / indicator | What it does |
|---|---|
| Sun / moon theme button | Switches between Light and Dark themes. Light is the default. The selected theme is saved in this browser using local storage, so it remains selected on the next visit in the same browser profile. |
| API status badge (not a button) | Shows the product API connection/loading status. It changes when the product catalogue is being loaded or when an API error occurs. |

### Camera and product scanning

| Button | What it does |
|---|---|
| **Start camera** | Requests camera permission and starts the camera, preferring the rear-facing camera on a phone. It also initializes the English OCR engine if needed and starts monitoring the scanning frame. |
| **Capture now** | Takes a scan immediately instead of waiting for the automatic steady-frame capture. It is enabled while the camera is running and ready. |
| **Stop camera** | Stops the active camera tracks and releases the camera. Start Camera can be used again when another scan is needed. |
| **Scan another product** | Clears the previous selected-product result and prepares the scanner for another product. If the camera is still running, scanning can continue without restarting it. |
| **＋ Add to Cart** | Adds the currently selected product to the active cart. In Stock mode it adds it to the Stock-in Cart; in Selling mode it adds it to the Sale Cart. Adding an already-present product increases its quantity. |
| OCR match suggestion buttons | When multiple likely matches are found, each suggestion can be selected to choose that product. The selected product's name, MRP, DP, and PV are then displayed. |

**Scanning tip:** Keep the printed product name inside the horizontal frame, hold the phone steady, use good lighting, and avoid glare. Automatic capture detects a steady image; it cannot guarantee that the text is in focus. Use **Capture now** if you want to choose the capture moment yourself.

### Mode switch

| Button | What it does |
|---|---|
| **Stock** | Opens the stock-management panel. The cart becomes the Stock-in Cart and its primary action becomes **SAVE STOCK-IN**. Stock List and Stock-in History are available in this mode. |
| **Selling** | Opens the sales workflow. The cart becomes the Sale Cart, the Actual / Record selector and sale controls appear, and Sale History is shown below the checkout actions. |

Switching modes does not intentionally discard a prepared cart. The app retains the cart's purpose when changing tabs, so a prepared sale cart remains a sale cart when returning to Selling.

### Stock mode buttons

| Button | What it does |
|---|---|
| **View stock list** | Opens or closes the current inventory list. Products are displayed in alphabetical order. Each row shows the product name, DP, PV, current quantity, and quantity controls. |
| **Stock-in history** | Opens or closes the list of saved stock-in transactions. The newest stock-in appears first. Select a record summary to expand or collapse its product details. |
| **CLEAR STOCK** | After confirmation, sets every inventory quantity to zero. It keeps product entries and does **not** delete stock-in history or sale history. This action cannot be undone unless a backup is available. |
| **−** beside a Stock List product | Decreases that product's available stock by one. Quantity cannot go below zero. |
| **＋** beside a Stock List product | Increases that product's available stock by one. |
| **− / ＋** in the Stock-in Cart | Decreases or increases the quantity being prepared for the next stock-in. Decreasing to zero removes the product from the cart. |
| **SAVE STOCK-IN** | Saves the prepared stock-in transaction. The entered quantities are added to current inventory and a stock-in history record is created. The cart is then cleared. |

The optional name field in Stock mode is a stock-in reference/note. If it is left blank, the history record is labelled **Stock-in**.

### Selling mode buttons and controls

| Button / control | What it does |
|---|---|
| **Actual** | Selects Actual Sale mode. This is the default sale type. Checkout deducts the full sold quantity from inventory, including free units. Checkout is blocked if available stock is insufficient. |
| **Record** | Selects Record Sale mode. It records a sale without deducting inventory. A Record Sale date and time field is displayed so an earlier or specific transaction time can be entered. |
| **Select product from available stock** | Dropdown containing products with available stock. Choose a product to add it directly to the Sale Cart. |
| **ADD** | Adds the selected dropdown product to the Sale Cart. It is unavailable for products with no stock. Actual Sale quantity is limited by available stock. |
| **− / ＋** in the Sale Cart | Decreases or increases the total quantity for a cart product. In Actual Sale mode, adding quantity is limited by available stock. |
| **Free qty** input | Sets how many units of that cart line are free. Free quantity cannot exceed total quantity. Paid quantity is total quantity minus free quantity. |
| **CHECK OUT ACTUAL SALE** | Saves an Actual Sale after validating stock and quantities. The full quantity (paid plus free) is deducted from stock. |
| **CHECK OUT RECORD SALE** | Saves a Record Sale using the selected record date/time. Inventory is not changed. |
| **UPDATE SALE** | Appears when editing an existing sale. Saves the edited transaction and recalculates the required stock adjustment according to the old and new sale types and quantities. |
| **CLEAR SALE CART** | After confirmation, clears the current sale cart and cancels an in-progress sale edit. It does not change stock or delete saved sale history. |
| **Edit / Return** in Sale History | Loads that saved sale into the Sale Cart for editing. Sales can be edited within seven days of the original record creation. After reviewing the quantities, type, and date/time, use the checkout/update action to save the changes. Changing between Actual and Record during an edit may change stock and requires confirmation. |
| **Delete** in Sale History | Permanently deletes the selected sale after confirmation. Deleting an Actual Sale returns its deducted quantities (including free units) to inventory. Deleting a Record Sale does not change stock. |

The customer name field is optional. If it is blank, the Sale History summary uses **Sale** as the display name.

### Cart controls shared by Stock-in and Selling

| Control | What it does |
|---|---|
| Product quantity **−** | Reduces the selected cart line by one. A line is removed when its quantity reaches zero. |
| Product quantity **＋** | Adds one to the selected cart line. Actual Sale cannot exceed available stock. |
| **Cart / Customer name** field | In Stock mode, enter an optional stock-in reference. In Selling mode, enter an optional customer name. |
| Cart summary | Shows product types, total quantity, total DP (or sale amount in Selling mode), and total PV. |
| Cart item count | Shows the total units in the cart, not just the number of different product types. |

### Backup buttons

| Button | What it does |
|---|---|
| **Export backup** | Downloads a JSON backup file to the device. The backup contains the dealer business data, inventory, stock-in history, sales history, and active cart data. Keep the downloaded file somewhere safe. |
| **Import backup** | Opens the device's file picker. Choose a valid Product Scanner Vestige JSON backup. The app validates the file and asks for confirmation before replacing the current browser's business data and active cart. |

**Important:** Import replaces the current browser's inventory, stock-in history, sales history, and active cart with the contents of the selected backup. Export a fresh backup before importing if the current data matters.

---

## Stock workflow

1. Open the app and select **Stock**.
2. Scan a product using **Start camera** and either wait for a steady-frame capture or tap **Capture now**.
3. Confirm the displayed product and its MRP, DP, and PV.
4. Tap **＋ Add to Cart**. Repeat for each product being received.
5. In the Stock-in Cart, adjust each quantity with **− / ＋**.
6. Optionally enter a stock-in reference in the name field.
7. Review product types, total quantity, total DP, and total PV.
8. Tap **SAVE STOCK-IN**.
9. Open **View stock list** to confirm the available quantities, or **Stock-in history** to review the saved transaction.

You can also increase or decrease existing inventory directly from the Stock List. These manual adjustments update current stock but do not create a stock-in history transaction.

### Current stock valuation

The Current Stock panel displays:
- **Stock DP Value:** sum of each product's DP multiplied by its available quantity.
- **Stock PV Value:** sum of each product's PV multiplied by its available quantity.

The current panel does not show a stock MRP total.

---

## Selling workflow

1. Select **Selling**.
2. Choose **Actual** or **Record**.
3. Add products by either:
   - Scanning the product and tapping **＋ Add to Cart**, or
   - Selecting a stocked product from the dropdown and tapping **ADD**.
4. Adjust quantities using **− / ＋**.
5. For free units, enter the free quantity in the **Free qty** field.
6. Optionally enter the customer name.
7. For Record Sale, choose the transaction date and time.
8. Review the sale amount, total quantity, product types, and PV.
9. Tap the appropriate checkout button.

### Actual Sale versus Record Sale

| Behaviour | Actual Sale | Record Sale |
|---|---|---|
| Checks available stock | Yes | No stock deduction is required |
| Deducts inventory | Yes | No |
| Free units included in stock deduction | Yes | Not applicable to inventory |
| Uses a sale date/time | Original/current transaction time | User-selectable date and time |
| Included in daily/monthly sales totals | Yes | Yes |

**Actual Sale safety:** Checkout is blocked if the requested total quantity is greater than available stock. Free units are still physical units and are included in the stock deduction.

**Record Sale purpose:** Use this mode to record a transaction that should appear in sales history and sales totals without changing current inventory. It is not a stock-out operation.

### Daily and monthly sales overview

Selling mode displays:
- **Total sale today**
- **Total sale this month**

Both Actual Sales and Record Sales contribute to these totals, using the saved sale date.

---

## Cart quantities, free products, and totals

The cart quantity represents the **total units**, including free units.

For example, if a customer receives three units and one is free:

- Total quantity: 3
- Free quantity: 1
- Paid quantity: 2
- Sale amount: DP × 2
- Actual Sale stock deduction: 3 units

The PV sale total is calculated from paid quantity. The inventory deduction for Actual Sale uses paid plus free quantity.

This distinction prevents free products from being charged while ensuring the physical units are deducted from stock.

---

## History lists and scrolling

The interface keeps long lists inside compact scrollable areas rather than allowing them to make the page excessively long.

| Area | Initial visible limit | Behaviour |
|---|---:|---|
| Stock List | 5 products | Additional products scroll inside the list. Products are alphabetical. |
| Stock-in History | 5 records | Additional records scroll inside the list. Newest first. |
| Sale Cart | 10 product rows | Additional cart rows scroll inside the cart area. |
| Sale History | 5 records | Additional records scroll inside the history area. Newest first. |

### Expandable history records

Stock-in History and Sale History initially show compact summaries. Tap a record's summary row to expand its product details; tap it again to collapse the details. Each record can be expanded independently.

**Stock-in summary** includes the reference/name, date and time, product-type count, total quantity, DP, MRP, and PV. Expanded details list products alphabetically with quantities and product values.

**Sale summary** includes the customer/name, date and time, sale type, product-type count, total quantity, amount sold, and total PV. Expanded details show each product's paid and free quantities. Sale history also retains the **Edit / Return** and **Delete** actions where applicable.

The history panels use natural scroll chaining: when the inner list reaches its top or bottom, continued scrolling can move the page rather than trapping the scroll inside the panel.

---

## Backup and restore

Business information is saved in the browser's local storage. The app does not provide account-based cloud synchronization.

### Recommended backup routine

1. Open the **Backup** section.
2. Tap **Export backup**.
3. Confirm that the JSON file has downloaded.
4. Store a copy somewhere safe, preferably outside the phone/computer as well.
5. Export another backup after important stock or sales changes.

### Restore on the same or another device

1. Open the app on the target device/browser.
2. Open the **Backup** section.
3. Tap **Import backup**.
4. Select the exported JSON file.
5. Read the replacement warning and confirm only if you intend to replace the current browser data.

The backup format currently identifies the app as `Product Scanner Vestige` and uses backup version `1`. Invalid or unsupported files are rejected.

---

## Product scanning and matching

### Product catalogue loading

The frontend requests the product catalogue from the configured Cloudflare product API. The API response is expected to be JSON with:
- `success: true`
- A `products` array

The frontend validates the response and loads usable product records. The API request has a 15-second timeout. The API badge and status text provide loading or error feedback.

### OCR process

The scanner uses Tesseract.js v5 with English recognition in the browser.

At a high level, the scan process:
1. Crops the camera image around the scanning frame.
2. Creates a high-resolution image for recognition.
3. Produces original, grayscale/contrast-enhanced, and black-and-white image variants.
4. Runs multiple OCR passes using different page-segmentation settings.
5. Combines recognized lines and removes duplicate/short results.
6. Sends the combined text to the product matching engine.

### Product matching

The matching engine normalizes text and compares words rather than requiring an exact full-string match. It tolerates some OCR spelling errors using token similarity and Levenshtein distance. Candidate products are ranked and up to five suggestions can be shown.

The displayed match score is a text-similarity score, **not** a statistical probability. Check the product name and displayed prices before adding a product to a business transaction.

---

## Data storage and business rules

- Inventory, stock-in records, sales records, and the active cart are stored locally in the browser.
- Data is scoped to the browser profile and website origin. A different browser, profile, or device has separate local data unless a backup is imported.
- Clearing site data, browser storage, or using a private/incognito session can make locally stored business data unavailable.
- Product catalogue data is fetched from the separate product API; dealer inventory and transactions are not uploaded to that API by the normal business workflow.
- Manual stock changes update inventory quantities but do not create stock-in records.
- CLEAR STOCK sets quantities to zero but retains product entries and transaction histories.
- Actual Sale deducts paid and free units from stock.
- Record Sale records the sale without changing stock.
- Deleting an Actual Sale restores the deducted units; deleting a Record Sale leaves stock unchanged.
- Sale edits are limited to seven days from the original sale creation time.
- Payment logging, refunds, customer phone-number management, and account-based multi-device synchronization are not part of the current visible workflow.

---

## Technical architecture

| Component | Responsibility |
|---|---|
| `index.html` | Main frontend markup, styles, application logic, camera workflow, OCR integration, matching, inventory, sales, history, and backup/restore. |
| GitHub Pages | Hosts the public frontend at the live app URL. |
| Cloudflare product API | Delivers the product catalogue to the frontend. This is separate from the browser's local dealer business data. |
| Tesseract.js v5 | Performs English OCR in the browser. |
| Browser MediaDevices API | Requests and controls camera access. |
| HTML Canvas API | Crops/resizes/processes camera images and creates image data used by OCR. |
| Browser LocalStorage | Persists local inventory, transaction history, active cart, and theme preference. |
| GitHub Actions | Runs repository regression checks on applicable changes. |
| Wrangler configuration / Cloudflare build | Supports the repository's configured Cloudflare static-assets build workflow; it is distinct from the separate product catalogue API. |

### Main URLs

- Website: https://vinay3301.github.io/PRODUCT-SCANNER-VESTIGE/
- Repository: https://github.com/vinay3301/PRODUCT-SCANNER-VESTIGE
- Product API: https://vestige-products-api.vinaykinnera3301.workers.dev/

The product API and the frontend hosting/deployment configuration have separate responsibilities. A frontend documentation or UI change does not require changing the product API Worker.

---

## Testing and maintenance

The repository includes automated regression checks for application business logic and important UI structure/behaviour. Recent work has included regression coverage for:

- Actual Sale and Record Sale stock behaviour.
- Free-quantity calculations and inventory deduction.
- Sale editing, type conversion, deletion, and date-based totals.
- Backup validation, import, migration, and storage-write rollback.
- Cart and list viewport limits.
- Alphabetical stock ordering and newest-first history ordering.
- Expandable history summaries and scroll chaining.
- Required UI elements and event-listener targets.

Run the repository's configured GitHub Actions workflows when changing application code. A passing automated suite does not replace testing the live app with representative business data on the intended phone/browser.

### Safe maintenance practices

1. Export a JSON backup before testing changes that could affect business data.
2. Make code changes on a feature branch and review them through a pull request.
3. Do not replace or remove the product API Worker when changing only the frontend.
4. Do not commit real customer or dealer transaction data, exported backups, API secrets, or private credentials.
5. Test Stock, Selling, Actual Sale, Record Sale, history actions, and backup restore after relevant changes.

---

## Troubleshooting

| Problem | Checks |
|---|---|
| Product API stays on Connecting or reports an error | Check internet access and the API status text. The product API request has a 15-second timeout. |
| Camera does not start | Open the HTTPS website, allow camera permission, check that another app is not using the camera, and use a browser that supports camera access. |
| OCR does not recognize the product | Improve lighting, reduce glare, move closer, keep the product name inside the frame, hold steady, or use **Capture now**. |
| Wrong product is selected | Review the candidate suggestions and manually choose the correct product before adding it to the cart. |
| Actual Sale checkout is blocked | Check the available quantity in Stock List. Actual Sale cannot deduct more units than are available. |
| Business data is missing on another device/browser | Local data is not synchronized. Import a previously exported JSON backup. |
| A history record appears compact | Tap its summary row to expand or collapse the product details. |
| Old page behaviour remains visible after a deployment | Reload the page and check the deployed commit/build. Browser caching may temporarily show an older frontend. |

---

## Current application scope

This README documents the current application represented by the repository's `main` branch and its current `index.html` UI. The exact controls and workflows may change as future pull requests are merged.

**Always verify product identity, quantities, free units, and totals before saving a stock-in or sale transaction.**
