# Product Scanner Vestige

A mobile-friendly, browser-based Vestige product and dealer sales manager. The application supports two ways to find products: live catalogue search and camera-based OCR scanning. It combines product pricing, local dealer inventory, stock-in, and sales workflows.

**Live application:** https://vinay3301.github.io/PRODUCT-SCANNER-VESTIGE/  
**Source repository:** https://github.com/vinay3301/PRODUCT-SCANNER-VESTIGE

---

## Contents

- [What the application does](#what-the-application-does)
- [Technology and data architecture](#technology-and-data-architecture)
- [Getting started](#getting-started)
- [Screen layout](#screen-layout)
- [Button-by-button guide](#button-by-button-guide)
- [Stock and sales calculations](#stock-and-sales-calculations)
- [History display and scrolling](#history-display-and-scrolling)
- [Local data, backup, and restore](#local-data-backup-and-restore)
- [Important operating notes](#important-operating-notes)
- [Repository and deployment](#repository-and-deployment)

---

## What the application does

The application has two connected purposes:

1. **Identify products:** Read a Vestige product name from its packaging with a phone camera, match the OCR text against the product catalogue, and show the product's MRP, DP, and PV.
2. **Manage dealer activity:** Maintain stock, record stock-in transactions, prepare sale carts, check out actual sales, record sales without changing stock, and review transaction history.

The interface is designed for mobile browsers and also works on desktop browsers. No separate Android installation is required.

## Technology and data architecture

| Component | Responsibility |
|---|---|
| HTML, CSS, JavaScript (index.html) | Application interface and client-side logic |
| GitHub Pages | Hosts the public website |
| Cloudflare Worker API | Supplies the product catalogue to the website |
| Google Sheets / published catalogue source | Upstream product information source used by the API |
| Tesseract.js v5 | Reads product-name text from captured images |
| Browser Camera API (getUserMedia) | Accesses the device camera |
| Canvas API | Crops and prepares camera images for OCR and creates cart images where used |
| Browser localStorage | Stores this browser's stock, stock-in history, sales history, and active cart |
| JSON backup file | Allows business data to be exported and restored manually |

### Product catalogue API

The frontend requests the product catalogue from:

https://vestige-products-api.vinaykinnera3301.workers.dev/

The API response is expected to contain success: true and a products array. The badge in the page header reports the number of products loaded or indicates an API connection problem.

The website and the Cloudflare Worker are separate components:

- GitHub Pages serves the frontend.
- The Cloudflare Worker supplies product data.
- Updating index.html does not, by itself, update or deploy the Worker.

### Local-first business data

Stock quantities, stock-in records, sales records, and the active cart are stored in the browser's local storage on the device/browser profile being used. They are not automatically synchronised to another phone, browser, or computer.

**Important:** Clearing browser/site data, changing browser profiles, or using another device can make locally stored records unavailable in that environment. Export a backup before doing so.

## Getting started

1. Open the [live application](https://vinay3301.github.io/PRODUCT-SCANNER-VESTIGE/) in a modern browser.
2. Wait for the product-count/API badge in the header to show that products have loaded.
3. Find a product by typing in the manual catalogue search, or press **SCAN** to reveal the camera scanner and then press **Start camera**.
4. The application opens in **Selling** mode when there is no unfinished cart. Choose **Stock** when entering stock received.
5. Use **Export backup** regularly and keep the downloaded JSON file somewhere safe.

Camera access normally requires HTTPS. The GitHub Pages address is served over HTTPS.

## Screen layout

The page contains these main areas:

- **Header:** VESTIGE SALES title, light/dark theme control, and product catalogue status.
- **Manual product search:** catalogue search field, SCAN/CLOSE toggle, matching product list, and local stock-status labels.
- **Camera scanner:** hidden until opened with SCAN; contains the live camera image, horizontal product-name scanning frame, and camera controls.
- **Product card:** selected product name, MRP, DP, PV, match information, and product-match choices.
- **Work-mode switch:** Stock and Selling.
- **Current Stock panel:** stock value summary, stock list, stock-in history, and clear-stock action. Shown in Stock mode.
- **Cart panel:** Stock-in Cart or Sale Cart depending on the active cart mode.
- **Selling controls:** sale type, sales totals, optional Record Sale date/time, and product picker. Shown in Selling mode.
- **Sale History:** shown in Selling mode.
- **Backup panel:** export and import business data.

---

## Button-by-button guide

### 1. Manual product search

The manual search is positioned above the camera scanner and uses an approximately **80% search field / 20% SCAN button** layout.

| Control | What it does |
|---|---|
| **Search product from catalogue** | Filters the already-loaded product catalogue as you type; it does not send a separate API request for every keystroke. Every typed term must match the beginning of a word in the product name. A full exact-name match is prioritised, and the remaining matches are sorted alphabetically. |
| **Matching product row** | Shows the product name on the left and its dealer stock status on the right. **In-stock** appears in green when the browser's local inventory quantity is greater than zero; **Out of stock** appears in red when the quantity is zero, negative, or missing. |
| **Select a matching product row** | Immediately selects that product and displays its MRP, DP, and PV in the existing product card. The search field and result list are then cleared. |
| **Search results area** | Shows up to five rows in its visible area. Additional matches are available by scrolling inside the results area; scrolling is contained so it does not chain to the surrounding page. |
| **SCAN** | Reveals the camera scanner area. It does not start the camera automatically; use **Start camera** inside the revealed area when ready. |
| **CLOSE** | Hides the scanner area when the camera is not running. If the camera is running or still starting, a confirmation dialog appears. |
| **CANCEL** | Closes the confirmation dialog and leaves the scanner open with the camera state unchanged. |
| **STOP CAMERA** | Stops the camera and closes the scanner area after confirmation. |

Stock status is read from this browser's local dealer inventory. It is not a live lookup of another device or a remote dealer database.

### 2. Scanner controls

| Button | What it does |
|---|---|
| **Start camera** | Requests access to the device camera, preferring the rear-facing camera on phones. It ensures the product catalogue is loaded and initializes the OCR worker. Once ready, the application monitors the image for steadiness and can capture automatically. |
| **Capture now** | Takes a capture immediately instead of waiting for the automatic steady-frame detector. The captured scanning area is processed through the OCR passes. It is disabled when capture is not currently available. |
| **Stop camera** | Stops the active camera tracks and releases the camera stream. Start the camera again when you want to scan. |
| **Scan another product** | Clears the previous product selection and match display so another product can be scanned. If the camera is still running, scanning resumes without requiring the camera to be started again. |

**Scanning tip:** Keep the printed product name inside the horizontal frame. Good lighting, a steady phone, and readable text improve recognition.

### 3. Product selection

| Control | What it does |
|---|---|
| **Product match choice** | Each suggested product is selectable. Tap the correct name to confirm it and display that product's MRP, DP, and PV. |
| **＋ Add to Cart** | Adds one unit of the selected product to the active Stock-in Cart or Sale Cart. In an Actual Sale, the application prevents adding more units than the available stock. |
| **Match score** | Shows how closely the OCR text matches a catalogue product. It is an algorithmic similarity score, not a guarantee or probability that the product is correct. |

The camera OCR matching engine displays up to five candidates. A sufficiently high top match can be selected automatically after a short delay, but the user can still choose a different suggested result. If the match is uncertain, select the correct result manually. Manual catalogue search is a separate path and selects a product immediately when its result row is tapped.

### 4. Work-mode controls

| Button | What it does |
|---|---|
| **Stock** | Switches to the stock-in workflow. Shows Current Stock, stock list, stock-in history, and the Stock-in Cart. The transaction button becomes **SAVE STOCK-IN**. |
| **Selling** | Switches to the selling workflow. Shows sale controls and Sale History, changes the cart to Sale Cart, and makes the transaction button **CHECK OUT SALE**. |

The application opens in **Selling** mode when there is no unfinished cart. If an unfinished cart exists, its saved purpose (Stock or Selling) is restored instead. The active cart is stored locally; switching modes does not silently clear the cart or change its purpose.

### 5. Stock mode

The Current Stock panel is visible in Stock mode.

| Button | What it does |
|---|---|
| **View stock list** | Opens or closes the current inventory list. Products are displayed in alphabetical order. Each product row shows DP, PV, and its current quantity. |
| **− (decrease stock)** | Reduces that product's on-hand stock by one unit. Stock cannot go below zero. |
| **＋ (increase stock)** | Increases that product's on-hand stock by one unit. |
| **Stock-in history** | Opens or closes the list of saved stock-in transactions. Select a history summary to expand or collapse its product details. |
| **CLEAR STOCK** | After confirmation, sets all current stock quantities to zero. It keeps product entries and stock-in/sale history; it does not delete the product catalogue. This action cannot be undone unless a backup is available. |
| **＋ Add to Cart** (on the product card) | Adds one unit of the selected catalogue product to the Stock-in Cart. |
| **SAVE STOCK-IN** | Saves all positive quantities in the Stock-in Cart as a stock-in transaction, increases the corresponding inventory quantities, adds a record to Stock-in History, and clears the completed cart. |

The Stock-in Cart name field is optional. It can be used for a supplier name, invoice/reference, or a short note. If left blank, the transaction is labelled **Stock-in**.

### 6. Selling mode

Selling mode provides the customer sale workflow.

| Button / control | What it does |
|---|---|
| **Actual** | Selects an Actual Sale. On successful checkout, the sold units—including units marked free—are deducted from stock. The application checks stock availability before allowing checkout. |
| **Record** | Selects a Record Sale. It records the sale details and amount without changing current stock. |
| **Record Sale date and time** | Appears when Record is selected. Sets the date and time stored with that Record Sale. |
| **Select product from available stock** | Dropdown containing products with a positive stock quantity. It is an alternative to scanning a product. |
| **ADD** | Adds one unit of the selected dropdown product to the Sale Cart. The dropdown is cleared after adding. |
| **CHECK OUT SALE** | Saves the sale record. For an Actual Sale, it also deducts the paid and free quantities from inventory. For a Record Sale, inventory is unchanged. The completed sale appears in Sale History and the cart is cleared. |
| **CLEAR SALE CART** | After confirmation, clears the current sale cart and cancels an in-progress sale edit. It does not change stock or delete existing sale history. |

The customer-name field is optional. If entered, the name is shown in the Sale History summary; otherwise the record is labelled **Sale**.

#### Free quantity

Each cart product row includes a free-quantity field in the selling workflow.

- Enter a whole number of free units.
- Free quantity cannot be negative or greater than the row's total quantity.
- Free units are included in the total quantity and stock deduction for an Actual Sale.
- Free units are excluded from the sale amount and PV calculation; the remaining paid quantity is used for those totals.

Example: if a customer receives 3 units and 1 is free, the cart quantity is 3, free quantity is 1, and 2 units are treated as paid units. An Actual Sale deducts all 3 units from stock.

### 7. Cart controls used in both modes

| Control | What it does |
|---|---|
| **Cart / Customer name** or **Stock-in reference** | Optional text field. Its label and placeholder change with the active cart mode. The value is stored with the active cart. |
| **＋ (increase cart quantity)** | Adds one unit to the selected cart line. In an Actual Sale, the available-stock limit is enforced. |
| **− (decrease cart quantity)** | Removes one unit from the selected cart line. When the quantity reaches zero, the line is removed. |
| **Free quantity** | In Selling mode, specifies how many units in that cart line are free. It must be a whole number from zero up to the total quantity. |
| **Cart Summary** | Displays product types, total quantity, the mode-specific amount (Total DP for Stock-in or Sale amount for Selling), and total PV. |

The cart is saved locally as it is edited, so a page refresh in the same browser profile should restore the active cart when browser storage remains available.

### 8. History controls

Stock-in History is in Stock mode; Sale History is in Selling mode.

| Control | What it does |
|---|---|
| **History summary (＋ / −)** | Tap a stock-in or sale summary to expand its product details. Tap it again to collapse those details. Each record expands independently. |
| **Edit / Return** | Available on eligible recent sale records (within seven days of their original creation). Loads the saved sale into the Sale Cart so it can be corrected and saved again. When editing an Actual Sale, the stock adjustment is recalculated against the original transaction. |
| **Delete** | Permanently deletes the selected sale record after confirmation. If it was an Actual Sale, its deducted quantities are returned to stock. Deleting a Record Sale does not change stock. |

Sale History is ordered newest first by sale date/time. Stock-in History is ordered newest first by stock-in creation time. Products inside an expanded stock-in record are alphabetically ordered.

### 9. Backup controls

| Button | What it does |
|---|---|
| **Export backup** | Downloads a versioned JSON backup containing business inventory, stock-in history, sales history, and the active cart. The file also retains the saved-cart data field for backup-format compatibility, but the current interface does not provide saved-cart management controls. Keep the downloaded file somewhere separate from the device. |
| **Import backup** | Opens a file picker for a previously exported Product Scanner JSON backup. The application validates the file and asks for confirmation before replacing the business data and cart data in this browser. |

**Import is a replacement, not a merge.** It replaces the current stock, stock-in history, sales history, active cart, and saved-cart compatibility data with the contents of the selected backup. Export the current state first if you may need it later.

### 10. Theme control

| Button | What it does |
|---|---|
| **Round sun/moon button in the header** | Toggles between light and dark themes. The selected theme is saved in this browser and restored on the next visit. |

---

## Stock and sales calculations

### Stock-in

When **SAVE STOCK-IN** is pressed:

1. Each positive cart quantity is added to the existing stock quantity for that product.
2. A stock-in history record is created with its date/time, optional reference/name, products, quantities, and DP/MRP/PV totals.
3. The Stock-in Cart is cleared after the data is saved.

### Actual Sale

When **CHECK OUT SALE** is pressed with **Actual** selected:

1. The application checks that enough stock is available for every cart line.
2. Paid and free units are both included in the quantity deducted from stock.
3. The sale amount is calculated using DP multiplied by paid quantity.
4. PV is calculated using PV multiplied by paid quantity.
5. The sale is saved to Sale History and inventory is reduced.

### Record Sale

When **Record** is selected:

1. The application saves the sale details and the selected record date/time.
2. The sale amount and PV are calculated from paid quantities.
3. Current inventory is not deducted or otherwise changed.

### Editing and deleting a sale

- Eligible sales can be edited within seven days of their original creation.
- Saving an edited Actual Sale recalculates the stock effect by accounting for the original transaction and the revised quantities.
- Deleting an Actual Sale returns its paid and free quantities to stock.
- Deleting a Record Sale does not affect stock.

---

## History display and scrolling

To keep the page compact on phones:

- Manual catalogue search shows up to **five matching products** in its visible area; additional matches are available by scrolling inside that results area.
- The Stock List shows up to **five products** in its visible area; additional products are available by scrolling inside that list.
- Stock-in History shows up to **five transaction summaries** in its visible area; additional records are available by scrolling inside the list.
- Sale History shows up to **five transaction summaries** in its visible area; additional records are available by scrolling inside the list.
- History summaries start collapsed. Product details appear only when an individual record is expanded.
- History panels allow scroll chaining: when the list reaches its top or bottom, continued scrolling can move the surrounding page.
- The Stock List is alphabetical. Both histories are newest first.

These limits apply to the visible list area, not to the total number of records retained.

## Local data, backup, and restore

The application uses browser storage rather than a remote dealer database. In practical terms:

- Data belongs to the browser profile and device where it was entered.
- Opening the site on another device does not automatically bring across stock or sales records.
- Private/incognito sessions may have separate or temporary storage.
- Clearing site data can remove locally stored business records.
- A downloaded JSON backup is the portable copy used to move or restore data.

Recommended routine:

1. Export a backup after important stock or sales activity.
2. Keep more than one backup copy in a safe location.
3. Before importing, export the current browser data in case you need to return to it.
4. Import only a backup you trust; importing replaces the current local records.

The backup file contains business records and product details. Treat it as private business information.

## Important operating notes

- A working internet connection is required to load the product catalogue and external OCR library.
- Camera permission is required for camera scanning. Product selection from the available-stock dropdown can be used in Selling mode without scanning.
- OCR results can be imperfect. Always verify the product name and price details before adding or checking out.
- A match score is a similarity measure, not a correctness guarantee.
- Manual search stock labels reflect this browser's local inventory at the time the results are rendered; they do not represent stock held by other devices or dealers.
- Actual Sale and Record Sale have different inventory effects. Confirm the selected sale type before checkout.
- **Payment-method logging (Cash / Online) is not exposed as a control in the current index.html workflow.** This README intentionally does not describe it as an available feature.
- The current application does not provide automatic cloud synchronisation of dealer stock or sales data.

## Repository and deployment

### Main files

| File / location | Purpose |
|---|---|
| index.html | Main application: markup, styles, scanner, OCR, stock, sales, history, and backup logic |
| manifest.webmanifest | Web app manifest referenced by the page |
| README.md | Project and user documentation |

Keep companion files referenced by the HTML in the repository. The Cloudflare Worker source/configuration is a separate deployment component and is not contained in the frontend HTML.

### Live website

GitHub Pages serves the application at:

https://vinay3301.github.io/PRODUCT-SCANNER-VESTIGE/

### Updating the frontend

1. Make frontend changes in a dedicated Git branch.
2. Review the diff and run the repository's applicable regression checks.
3. Open a pull request into main.
4. Merge only after the changes and checks have been reviewed.
5. Confirm the GitHub Pages deployment and test the live website.

A frontend-only README or HTML change does not require a Cloudflare Worker deployment.

---

*Documentation checked against the current `main` branch `index.html`, regression test file, and merged PRs #12–#15, plus the two later direct `index.html` commits that updated the page title/status text and product-count badge. Keep this guide synchronized with future UI and workflow changes.*
