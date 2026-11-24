# VESTIGE PRODUCT SCANNER
## Complete Project Documentation – README

**Project Name:** Vestige Product Scanner  
**Application Type:** Mobile-friendly web application / camera-based product scanner  
**Primary Device:** Android smartphone  
**Database:** Google Sheets  
**Frontend Hosting:** GitHub Pages  
**Backend API:** Cloudflare Workers  
**OCR Technology:** Tesseract.js v5  
**Internet Requirement:** Required  
**Main Purpose:** Scan the printed name of a Vestige product using a mobile camera, identify the matching product from a database, display its MRP, DP and PV, and prepare customer shopping carts.

---

# 1. PROJECT OVERVIEW

The Vestige Product Scanner is a browser-based application developed to make product identification and price checking easier.

Instead of manually searching through a product catalogue or Google Sheet, the user can point an Android phone's rear camera towards a product. The application captures the product name, extracts the text using Optical Character Recognition (OCR), compares the extracted text against the product database, and displays the most likely matching product.

After identifying a product, the user can:

- View its product name.
- View MRP (Maximum Retail Price).
- View DP (Distributor Price).
- View PV (Point Value).
- Add the product to a shopping cart.
- Increase or decrease product quantities.
- Calculate total DP and PV.
- Save carts under customer or order names.
- Load previously saved carts.
- Export a cart as a PNG image.
- Share the exported image using Android's native sharing interface when supported.

The application is designed primarily for Android mobile devices and can be opened through a normal web browser. Users do not need to install a separate Android application.

# 2. PROJECT REQUIREMENTS AND DESIGN DECISIONS

The project was designed around the following requirements:

1. **Mobile-first operation:** The scanner should work on an Android smartphone.
2. **No barcode dependency:** Product identification should use printed product names rather than barcode scanning.
3. **Central product database:** Product information should come from Google Sheets.
4. **Public access:** Users should be able to open the scanner without signing in to Google.
5. **Low-cost infrastructure:** Use free or free-tier hosting services wherever possible.
6. **OCR-based identification:** Read product names directly from product packaging.
7. **Intelligent matching:** Allow for common OCR recognition errors and display alternative matches.
8. **Shopping cart:** Support multiple products and quantities.
9. **Cart persistence:** Preserve active and saved carts in the same browser.
10. **Image export:** Generate a shareable shopping cart image.

# 3. COMPLETE SYSTEM ARCHITECTURE

The project uses separate components for the user interface, database, API and hosting.

## 3.1 Architecture diagram

    ANDROID SMARTPHONE
            |
            v
       WEB BROWSER
            |
            v
     GITHUB PAGES WEBSITE
            |
            |---- HTML
            |---- CSS
            |---- JavaScript
            |---- Camera API
            |---- Tesseract.js OCR
            |---- Image Processing
            |---- Product Matching
            |---- Shopping Cart
            |
            v
      CLOUDFLARE WORKER API
            |
            v
       PUBLISHED CSV DATA
            |
            v
       GOOGLE SHEETS
            |
            v
       PRODUCTS DATABASE

The application also uses the browser's local storage for active and saved shopping carts.

## 3.2 How the components communicate

**Frontend – GitHub Pages**

GitHub Pages hosts the website. The browser downloads the HTML file and executes its CSS and JavaScript.

**Database – Google Sheets**

Google Sheets stores the product information. The product database is maintained in a sheet named `products`.

**Data delivery – Cloudflare Worker**

The Cloudflare Worker acts as an API between the website and the published Google Sheets CSV.

It retrieves the published product data and provides it to the frontend in JSON format.

**OCR – Tesseract.js**

Tesseract.js processes the captured product image and extracts readable text.

**Browser storage – LocalStorage**

The browser stores active carts and saved carts locally on the user's device.

**Image export – HTML Canvas**

The application creates a PNG image of the shopping cart using the browser's Canvas API.

# 4. TECHNOLOGIES USED

| Technology | Purpose |
|---|---|
| HTML5 | Structure of the web application |
| CSS3 | User interface, layout, colours and responsive design |
| JavaScript | Application logic and interactions |
| Tesseract.js v5 | Optical Character Recognition |
| Google Sheets | Product database |
| Published Google Sheets CSV | Public product data source |
| Cloudflare Workers | Backend API and data delivery |
| GitHub | Source code repository |
| GitHub Pages | Website hosting |
| Browser MediaDevices API | Access to the mobile camera |
| HTML Canvas API | Image capture, processing and PNG generation |
| Browser LocalStorage | Save active and saved carts |
| Web Share API | Share cart images through supported devices and browsers |
| JavaScript Fetch API | Retrieve product data from the Cloudflare API |

No separate database server or conventional application server is required for the frontend.

# 5. GOOGLE SHEETS DATABASE

## 5.1 Database location

The project uses Google Sheets as its product database.

Google Sheets:

https://docs.google.com/spreadsheets/d/1Rv4fyxwKnA-TS77cFlt0YGdCELaVeaN3axpwjV0yFs8/edit

The relevant worksheet/tab is named:

`products`

## 5.2 Database structure

The database uses four main columns:

| Column | Description |
|---|---|
| name | Full product name |
| MRP | Maximum Retail Price |
| DP | Distributor Price |
| pv | Point Value |

Example structure:

    name                         MRP       DP       pv
    -----------------------------------------------------
    Assure Hair Conditioner      365       256      7.67
    Assure Hair Oil               283       198      6.60
    Assure Hair Shampoo           262       184      4.58

The values above are illustrative examples of the database structure.

## 5.3 Why Google Sheets was selected

Google Sheets makes product database maintenance simple.

The product list can be updated without changing the website's HTML code.

For example:

- Add a new product by adding a new row.
- Update the MRP by editing the MRP cell.
- Update the DP by editing the DP cell.
- Update the PV by editing the PV cell.

The application retrieves the product information through the API rather than requiring the user to manually upload a new database file.

## 5.4 Publishing the spreadsheet as CSV

The product worksheet is published in CSV format so that the backend can retrieve its data.

Published CSV address:

https://docs.google.com/spreadsheets/d/e/2PACX-1vQqxE08q7N5Wjv51m_mmoPusiqbdWXYvAMuuEUNh-M-0CCNkkQBU5a6tkyqAXCZ4aYhZn1IRWuiD7sG/pub?gid=1169149957&single=true&output=csv

The CSV is a machine-readable version of the product worksheet.

**Important:** The published CSV is publicly accessible. Only information intended for public access should be placed in this worksheet.

# 6. CLOUDFLARE WORKER – BACKEND API

## 6.1 Why a Cloudflare Worker was introduced

Initially, the project used a Google Apps Script-based data access approach.

However, the original approach created access and compatibility difficulties when the browser had multiple Google accounts signed in. It could work in Incognito mode while behaving differently in a normal browser session.

The project required a public scanner that ordinary users could open without changing their Google account or signing in.

To solve this, the product data delivery system was moved to a standalone Cloudflare Worker.

## 6.2 Role of the Worker

The Cloudflare Worker acts as an intermediary between Google Sheets and the website.

Its general workflow is:

1. Receive a request from the scanner website.
2. Retrieve the published CSV data.
3. Read and convert the product records into structured data.
4. Return a JSON response.
5. Allow the frontend to use the product records for matching and price display.

The frontend does not need to access the Google Sheet through a user's Google login.

## 6.3 API endpoint

The application uses this API address:

https://vestige-products-api.vinaykinnera3301.workers.dev/

The HTML file contains this endpoint in its JavaScript configuration:

    const API_URL =
    "https://vestige-products-api.vinaykinnera3301.workers.dev/";

The frontend requests the API using JavaScript's `fetch()` function.

It checks that:

- The HTTP response is successful.
- The response is valid JSON.
- The response contains `success: true`.
- The response contains a `products` array.

The application then loads the product records into memory.

The API status is displayed at the top of the website.

## 6.4 Important separation

There are two separate deployment components:

- The GitHub Pages website hosts the scanner interface.
- The standalone Cloudflare Worker provides the product API.

They have different responsibilities and should not be confused with each other.

The existing scanner website and its original hosting configuration should not be deleted or replaced when maintaining the separate product API.

# 7. GITHUB AND WEBSITE HOSTING

## 7.1 GitHub repository

The source code repository is:

https://github.com/vinay3301/PRODUCT-SCANNER-VESTIGE

GitHub stores the website files and provides version history.

## 7.2 GitHub Pages website

The public scanner website is:

https://vinay3301.github.io/PRODUCT-SCANNER-VESTIGE/

GitHub Pages serves the frontend files over HTTPS.

HTTPS is important because modern browsers generally require a secure context before allowing camera access.

## 7.3 Website files

The main application file is:

`index.html`

The HTML file contains:

- Page structure.
- CSS styling.
- JavaScript application logic.
- Camera handling.
- OCR processing.
- Product matching.
- Shopping cart functions.
- Cart export functions.

The HTML also references a companion web app manifest:

`manifest.webmanifest`

The manifest is a separate file and should be kept available in the deployed website.

Other companion files, such as any existing service-worker file, should be preserved if they are part of the deployed repository.

The uploaded HTML alone does not contain the source code of the Cloudflare Worker or the contents of the manifest.

## 7.4 Updating the website

When the frontend needs to be updated:

1. Open the GitHub repository.
2. Open the repository's main branch.
3. Locate `index.html`.
4. Replace its contents with the updated HTML code.
5. Commit the changes.
6. Wait for GitHub Pages to publish the update.
7. Open the public scanner website and test it.

When only the HTML application is being updated, do not unnecessarily delete or replace the API Worker, manifest or other existing companion files.

If an older version continues appearing, browser cache or service-worker caching may be responsible. Clearing the website's stored browser data can help confirm whether the latest deployment is being loaded.

# 8. FRONTEND USER INTERFACE

The interface uses a dark green colour scheme.

It is designed to be readable on a mobile screen and includes the following main sections:

1. Product Scanner header.
2. API connection indicator.
3. Camera preview.
4. Scanning frame.
5. Camera controls.
6. Product information card.
7. Product match suggestions.
8. Shopping cart.
9. Cart summary.
10. Saved carts section.

The layout uses responsive CSS so that the product information and cart controls adapt to smaller screens.

# 9. CAMERA SCANNING SYSTEM

## 9.1 Starting the camera

The user taps the `Start camera` button.

The application requests camera access through:

`navigator.mediaDevices.getUserMedia()`

The camera request prefers:

- Rear-facing camera (`environment`).
- Ideal video width of 1920 pixels.
- Ideal video height of 1080 pixels.
- No audio.

The live camera stream is displayed in the webpage's video element.

The browser may ask the user for camera permission the first time.

## 9.2 Scanning frame

A horizontal green scanning frame is displayed over the camera preview.

The current HTML uses:

- Left position: 6%.
- Top position: 32%.
- Width: 88%.
- Height: 36%.

The user should position the product name inside this frame.

The OCR crop is calculated from the displayed camera area to focus recognition on the relevant region.

The current crop uses approximately 88% of the visible width and 36% of the visible height.

## 9.3 Automatic capture when the image becomes steady

The application includes a frame-stability monitoring mechanism.

It periodically samples the camera image.

The process is:

1. Capture a small image sample from the scanning region.
2. Resize the sample to 32 × 40 pixels.
3. Convert the sample into grayscale values.
4. Compare the current sample with the previous sample.
5. Calculate the average pixel difference.
6. Treat the image as stable when the difference is below the configured threshold.
7. Require three consecutive stable checks before automatically capturing.

The monitoring interval is approximately 350 milliseconds.

This is an image-movement detection method. It does not directly measure autofocus quality or guarantee that the product text is in focus.

## 9.4 Manual capture

The application also includes a `Capture now` button.

The user can manually capture the product whenever necessary.

This is useful when:

- Automatic capture takes too long.
- The camera is already steady.
- The user wants to control the exact capture moment.

## 9.5 Stop camera

The `Stop` button stops the active camera tracks and releases the camera stream.

The user can start the camera again when required.

## 9.6 Scan another product

After a product is selected, the user can tap:

`Scan another product`

This resets the previous product selection and allows the next scanning session to begin.

# 10. OCR – OPTICAL CHARACTER RECOGNITION

## 10.1 What is OCR?

Optical Character Recognition is a technology that extracts text from an image.

In this project, OCR reads product names printed on product packaging.

The application uses:

**Tesseract.js version 5**

The library is loaded through the following CDN:

https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js

The OCR language configured in the application is English.

The OCR engine runs inside the browser rather than requiring a separate OCR server.

## 10.2 OCR initialization

When the camera is started, the application checks whether Tesseract.js is available.

It then creates an OCR worker:

    Tesseract.createWorker("eng")

The worker is reused for subsequent scans while the page remains active.

## 10.3 High-resolution image preparation

The application does not simply send the entire live camera frame directly to OCR.

It first:

1. Calculates the scanning crop.
2. Extracts the relevant camera region.
3. Creates a separate image using HTML Canvas.
4. Upscales the image to improve the amount of text detail available to OCR.
5. Limits the maximum image dimension to 2000 pixels.
6. Uses high-quality image smoothing.

The configured upscale factor is 1.7, subject to the maximum dimension limit.

## 10.4 Image processing

The application creates additional processed versions of the captured image.

### Original image

The original cropped image is used for OCR.

### Grayscale image

The colour image is converted into grayscale.

The processing uses a contrast factor of 1.45 to make text differences more visible.

### Binary image

The grayscale image is converted into black and white.

The application calculates an Otsu threshold using the image's grayscale histogram.

Pixels are then classified as black or white based on that threshold.

This creates a high-contrast version of the product text.

## 10.5 Multi-pass OCR

The application performs three OCR passes.

| Pass | Image | Page segmentation mode |
|---|---|---|
| Pass 1 | Original high-resolution image | 11 |
| Pass 2 | Grayscale image | 6 |
| Pass 3 | Black-and-white image | 7 |

Each pass uses a different Tesseract page segmentation mode.

The purpose is to give OCR multiple opportunities to recognize the same product name under different image-processing conditions.

The recognized text from all successful passes is collected.

## 10.6 Combining OCR results

The OCR results are combined into one text string.

The application:

1. Splits the OCR results into lines.
2. Removes leading and trailing spaces.
3. Ignores very short lines.
4. Normalizes the text.
5. Removes duplicate normalized lines.
6. Combines the unique lines.

The resulting text is passed to the product matching system.

# 11. PRODUCT MATCHING ENGINE

## 11.1 Purpose

OCR does not always recognize every character correctly.

For example, the product name may be read with:

- Missing letters.
- Incorrect letters.
- Extra characters.
- Inconsistent spaces.
- Different punctuation.
- Partial words.

Therefore, exact string matching is not sufficient.

The application uses a token-based similarity matching system.

## 11.2 Text normalization

Before comparing names, the application normalizes the text.

The normalization process:

1. Converts text to lowercase.
2. Normalizes Unicode characters.
3. Removes accent marks.
4. Replaces punctuation and special characters with spaces.
5. Removes repeated spaces.
6. Splits the text into individual words.

This allows text to be compared without depending on capitalization or punctuation.

## 11.3 Word-based comparison

The application compares individual words from the OCR result with individual words from each product name.

It does not require the words to appear in exactly the same order.

Each database product is evaluated against the OCR text.

## 11.4 Handling OCR spelling errors

The matching engine uses two main methods.

**A. Partial word matching**

If one word contains another and the shorter word has at least four characters, the algorithm can assign a partial similarity score.

**B. Levenshtein distance**

Levenshtein distance measures how many character insertions, deletions or substitutions are needed to change one word into another.

This helps the application recognize certain OCR spelling errors.

For short words, the matching engine applies stricter restrictions to avoid excessive false matches.

## 11.5 Weighted matching

The application gives longer product-name words more weight.

The weight of a product-name token is its length, capped at 12.

For each product-name word, the algorithm finds the best similarity against the OCR words.

It then calculates:

- Total weighted similarity.
- Number of matched words.
- Word coverage.

A coverage bonus is added when enough of the product-name words are recognized.

The final score is limited to a maximum of 100%.

**Important:** The displayed match score is an algorithmic similarity score, not a statistical probability that the product is correct.

## 11.6 Top-five results

After calculating scores for the database products:

1. Products are sorted by their similarity score.
2. Coverage is used as a secondary sorting factor.
3. The five highest-ranked matches are returned.

The user can see the candidate product names and their match scores.

This makes it possible to distinguish between similar products.

## 11.7 Minimum match threshold

The application uses:

`MIN_MATCH_THRESHOLD = 0.20`

If the best match is below 20%, the application displays:

`No clear product match`

The user can then improve the camera position, lighting or product visibility and scan again.

## 11.8 Automatic product selection

The application uses:

`AUTO_MATCH_THRESHOLD = 0.62`

This means the top match must reach at least 62% before automatic selection is scheduled.

The delay is:

`AUTO_FINALIZE_DELAY_MS =

# 12. DEALER STOCK MANAGEMENT

The dealer inventory and sales features run entirely in the browser. Each dealer's inventory is stored in that dealer's own browser storage. There is no dealer account, shared stock database, or automatic synchronization between devices or browsers.

## 12.1 Stocking mode

Use **Stocking** when products are received into the dealer's shop.

1. Scan products or add them to the current cart.
2. Increase the quantity for each product.
3. Tap **SAVE STOCK-IN** to post the receipt.
4. The saved quantities are added to the available inventory.

Each stock-in creates a separate dated history record. The stock summary displays the current inventory value using product MRP, DP and PV. Stock-in history retains the item quantities and price/point values captured at the time of receipt.

## 12.2 Current stock

The stock list displays products with a positive available quantity. The scanner uses these balances when building a sale. Stock values are calculated from the product prices stored with each inventory item.

# 13. SELLING MODE

Use **Selling** to prepare and save customer sales.

- The customer name is optional.
- The cart displays the available stock for each product.
- The app prevents paid plus free quantities from exceeding available stock, and checks stock again before saving.
- A sale is valued using the paid quantity multiplied by the product DP.
- Free quantity is charged at zero but is included in the quantity deducted from stock.
- Stock is deducted when the sale is saved, regardless of whether the customer has paid.

## 13.1 Payments and outstanding balance

A dealer may record an amount received when saving the sale or add payments later from Sales history. Payment methods are **Cash** and **Online**. Each payment is retained as a dated ledger entry.

The payment status is calculated from the sale total and net payments:

- **Unpaid:** no net payment received.
- **Partially paid:** some payment received, but an amount remains outstanding.
- **Paid:** the sale total has been received.
- **Refund due:** a sale was revised down after more money had been received than the revised sale total.

## 13.2 Returns and editing saved sales

A saved sale can be edited within seven days of its original date. Load it from Sales history using **Edit / return**, change quantities or products in the cart, and save the changes.

Only the inventory difference is applied:
- Increasing a sale quantity deducts only the additional quantity.
- Decreasing a quantity returns the difference to stock.
- Removing a product returns its full previous quantity.
- Adding a product deducts the newly added quantity.

Previous payment and refund entries are not deleted when a sale is edited. The app retains a revision record containing the previous sale lines and total.

## 13.3 Refunds

If a revised sale total is lower than the net amount already received, Sales history shows the refund due. Use **Record refund** after actually returning money to the customer. Record the refund amount and whether it was paid by Cash or Online. Refunds are stored separately from the original payment entries.

# 14. LOCAL DATA AND BACKUPS

The app stores the following information in the current browser:

- Active cart and existing saved carts.
- Current inventory quantities.
- Stock-in history.
- Sales history and sale revisions.
- Payment and refund ledgers.

This storage is local to the browser profile. Data is not automatically copied to another browser, phone, or computer. Clearing browser/site data may permanently remove it.

Use **Export backup** to download a JSON backup to the device. It includes inventory, stock-in history, sales, payments, refunds, active cart and saved carts. Use **Import backup** in the destination browser to restore it. Import validates the backup and asks for confirmation before replacing the data currently stored in that browser.

**Important:** Keep backup files somewhere safe. Export a fresh backup regularly and before clearing browser data, changing devices, or changing browsers.

# 15. IMPORTANT OPERATING NOTES

1. Use Stocking mode for incoming products and Selling mode for customer sales.
2. Save each stock-in or sale only once. A saved transaction updates inventory immediately.
3. Free quantities reduce stock even though they do not increase the sale value.
4. Sale edits are restricted to seven days after the original sale date.
5. Payments and refunds are recorded as separate dated entries; editing a sale does not erase those entries.
6. The inventory is private to the local browser profile, not protected by a dealer login. Anyone using the same browser profile can access its stored data.
