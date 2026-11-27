// Isolated regression tests for dealer inventory and the Actual Sale / Record Sale workflows.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const start = html.indexOf("function emptyBusinessData()");
const end = html.indexOf("// PRODUCT MATCHING", start);
assert.ok(start >= 0 && end > start, "Could not locate business-logic section in index.html");
const businessSource = html.slice(start, end);
const totalsStart = html.indexOf("function calculateCartTotals(items)");
const totalsEnd = html.indexOf("\n// RENDER SAVED CARTS", totalsStart);
assert.ok(totalsStart >= 0 && totalsEnd > totalsStart, "Could not locate cart totals function");
const totalsSource = html.slice(totalsStart, totalsEnd);
const normalizeStart = html.indexOf("function normalizeCartItem(item)");
const normalizeEnd = html.indexOf("\nfunction loadCartFromStorage()", normalizeStart);
assert.ok(normalizeStart >= 0 && normalizeEnd > normalizeStart, "Could not locate cart normalization function");
const normalizeSource = html.slice(normalizeStart, normalizeEnd);

function createHarness() {
  const elements = new Map();
  const alerts = [];
  const storage = new Map();
  let failStorageWrites = false;
  function $(id) {
    if (id === "salePaymentDialog" && !elements.has(id)) return null;
    if (!elements.has(id)) {
      elements.set(id, {
        value: "", textContent: "", innerHTML: "", disabled: false, files: [], style: {}, children: [], scrollTop: 0,
        classList: { contains: () => false, toggle: () => {}, add: () => {}, remove: () => {} }, dataset: {}, onclick: null,
        setAttribute: () => {},
        addEventListener: () => {}, previousElementSibling: { textContent: "" },
        querySelector: () => ({ textContent: "" }), scrollIntoView: () => {}
      });
    }
    return elements.get(id);
  }
  const fakeDocument = {
    createElement: tag => ({ tagName: tag, id: "", hidden: false, dataset: {}, addEventListener: (name, fn) => { fakeDocument.listeners.set("created:" + name, fn); } }),
    body: { appendChild: el => elements.set(el.id, el) },
    listeners: new Map()
  };
  const context = {
    document: fakeDocument,
    businessData: { schemaVersion: 1, inventory: {}, stockIns: [], sales: [] },
    cart: [], cartName: "", modeCarts: { stocking: { cart: [], cartName: "" }, selling: { cart: [], cartName: "" } }, savedCarts: [], currentMode: "stocking",
    editingSaleId: null, transactionBusy: false, saleType: "actual", cartMode: "stocking",
    BUSINESS_STORAGE_KEY: "test-business", CART_STORAGE_KEY: "test-cart", SAVED_CARTS_STORAGE_KEY: "test-saved",
    $, localStorage: {
      setItem: (k, v) => { if (failStorageWrites) throw new Error("QuotaExceededError"); storage.set(k, v); },
      getItem: k => storage.has(k) ? storage.get(k) : null,
      removeItem: k => storage.delete(k)
    },
    normalizeText: v => String(v || "").toLowerCase(),
    numericValue: v => Number(v) || 0,
    formatCartMoney: v => "₹" + Number(v).toFixed(2),
    formatMoney: v => String(v),
    escapeHtml: v => String(v ?? ""),
    setStatus: () => {}, saveCartToStorage: () => {}, loadCartFromStorage: () => {}, loadSavedCartsFromStorage: () => {},
    alert: message => alerts.push(String(message)), confirm: () => true, console
  };
  vm.runInNewContext(businessSource, context, { filename: "index.html#dealer-business-logic" });
  vm.runInNewContext(totalsSource, context, { filename: "index.html#cart-totals" });
  vm.runInNewContext(normalizeSource, context, { filename: "index.html#cart-normalization" });
  const originalPostSale = context.postSale;
  context.postSale = () => {
    originalPostSale();
    if (!context.deferPaymentChoice) {
      const listener = fakeDocument.listeners.get("created:click");
      if (listener) listener({ target: { closest: () => ({ dataset: { paymentChoice: context.testPaymentChoice || "paid" } }) } });
    }
  };
  // Keep UI rendering inert in this isolated business-logic harness.
  context.renderCart = () => {};
  context.saveCartToStorage = () => {};
  context.loadCartFromStorage = () => {};
  context.loadSavedCartsFromStorage = () => {};
  $("saleDateInput").value = new Date().toISOString().slice(0, 16);
  return { context, alerts, storage, $, setFailStorageWrites: value => { failStorageWrites = value; } };
}

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, status: "PASS" }); }
  catch (error) { results.push({ name, status: "FAIL", error: error.message }); }
}
function product(name, MRP, DP, pv) { return { name, MRP, DP, pv }; }
const assure = product("ASSURE ENCHANT BODY TALK", 103, 73, 1.99);
const conditioner = product("ASSURE HAIR CONDITIONER", 330, 280, 2.9);
const k1 = "assure enchant body talk";
const k2 = "assure hair conditioner";
function seedStock(x, key = k1, item = assure, quantity = 5) {
  x.context.businessData.inventory[key] = { product: item, quantity };
}
function addSale(x, type = "actual", quantity = 2, freeQuantity = 1, date = new Date().toISOString()) {
  const c = x.context;
  seedStock(x, k1, assure, 10);
  c.currentMode = "selling";
  c.saleType = type;
  c.cart = [{ key: k1, product: assure, quantity, freeQuantity, quantityIncludesFree: true }];
  x.$("saleDateInput").value = date.slice(0, 16);
  c.postSale();
  return c.businessData.sales[0];
}

test("All inline JavaScript blocks in the page have valid syntax", () => {
  const blocks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(code => code.trim());
  assert.ok(blocks.length > 0);
  blocks.forEach((code, index) => new vm.Script(code, { filename: "index.html inline script " + (index + 1) }));
});

test("Sales startup markup includes the history container required by initialization", () => {
  assert.match(html, /id="salesHistoryList"/);
  assert.match(html, /const history=\$\("salesHistoryList"\) \|\| document\.createElement\("div"\)/);
  assert.match(html, /document\.head\.appendChild\(style\)/);
});

test("Legacy cart free quantities migrate once into total quantity", () => {
  const x = createHarness();
  const migrated = x.context.normalizeCartItem({ key: k1, product: assure, quantity: 2, freeQuantity: 1 });
  assert.equal(migrated.quantity, 3);
  assert.equal(migrated.freeQuantity, 1);
  assert.equal(migrated.quantityIncludesFree, true);
  assert.equal(x.context.normalizeCartItem(migrated).quantity, 3);
});

test("Stock-in adds quantity and creates history", () => {
  const x = createHarness();
  x.context.cart = [{ key: k1, product: assure, quantity: 5, freeQuantity: 0 }];
  x.context.postStockIn();
  assert.equal(x.context.getStockQuantity(k1), 5);
  assert.equal(x.context.businessData.stockIns.length, 1);
});

test("Stock valuation retains accurate MRP, DP and PV calculations", () => {
  const x = createHarness();
  seedStock(x, k1, assure, 5);
  seedStock(x, k2, conditioner, 1);
  const totals = x.context.getInventoryTotals();
  assert.ok(Math.abs(totals.mrp - 845) < 0.001);
  assert.ok(Math.abs(totals.dp - 645) < 0.001);
  assert.ok(Math.abs(totals.pv - 12.85) < 0.001);
});

test("Actual Sale deducts paid and free units; free unit is excluded from amount and PV", () => {
  const x = createHarness();
  seedStock(x, k1, assure, 5);
  x.context.currentMode = "selling";
  x.context.saleType = "actual";
  x.context.cart = [{ key: k1, product: assure, quantity: 3, freeQuantity: 1 }];
  x.context.postSale();
  const sale = x.context.businessData.sales[0];
  assert.equal(x.context.getStockQuantity(k1), 2);
  assert.equal(sale.items[0].quantity, 2);
  assert.equal(sale.items[0].freeQuantity, 1);
  assert.equal(sale.total, 146);
});

test("An entirely free one-unit Actual Sale is valid and deducts one unit", () => {
  const x = createHarness();
  seedStock(x, k1, assure, 1);
  x.context.currentMode = "selling";
  x.context.saleType = "actual";
  x.context.cart = [{ key: k1, product: assure, quantity: 1, freeQuantity: 1 }];
  x.context.postSale();
  assert.equal(x.context.getStockQuantity(k1), 0);
  assert.equal(x.context.businessData.sales[0].total, 0);
});

test("Record Sale stores a manually selected date and does not deduct stock", () => {
  const x = createHarness();
  seedStock(x, k1, assure, 5);
  x.context.currentMode = "selling";
  x.context.saleType = "record";
  x.$("saleDateInput").value = "2026-11-20T14:35";
  x.context.cart = [{ key: k1, product: assure, quantity: 3, freeQuantity: 1 }];
  x.context.postSale();
  const sale = x.context.businessData.sales[0];
  assert.equal(x.context.getStockQuantity(k1), 5);
  assert.equal(sale.saleType, "record");
  assert.equal(new Date(sale.saleDate).toISOString(), new Date("2026-11-20T14:35").toISOString());
  assert.equal(sale.total, 146);
});

test("Overselling is rejected for Actual Sale without changing stock or history", () => {
  const x = createHarness();
  seedStock(x, k1, assure, 2);
  x.context.currentMode = "selling";
  x.context.saleType = "actual";
  x.context.cart = [{ key: k1, product: assure, quantity: 3, freeQuantity: 0 }];
  x.context.postSale();
  assert.equal(x.context.getStockQuantity(k1), 2);
  assert.equal(x.context.businessData.sales.length, 0);
  assert.match(x.alerts.at(-1), /Insufficient stock/);
});

test("Stock List shows only positive quantities and has no direct quantity controls", () => {
  const start = html.indexOf("function renderInventory()");
  const end = html.indexOf("\nfunction clearAllStock()", start);
  assert.ok(start >= 0 && end > start, "Could not locate Stock List renderer");
  const source = html.slice(start, end);
  assert.match(source, /Object\.entries\(businessData\.inventory\)\.filter\(\(\[,v\]\)=>Number\(v\.quantity\)>0\)/);
  assert.match(source, /No products are currently in stock/);
  assert.doesNotMatch(source, /data-stock-key|data-stock-delta/);
  assert.doesNotMatch(html, /function adjustStockQuantity\(/);
  assert.doesNotMatch(html, /stock-quantity-controls/);
});

test("Clear Stock resets quantities but retains product catalogue and sale history", () => {
  const x = createHarness();
  seedStock(x, k1, assure, 7);
  x.context.businessData.sales = [{ id: "existing", createdAt: new Date().toISOString(), saleDate: new Date().toISOString(), saleType: "record", total: 20, items: [] }];
  x.context.clearAllStock();
  assert.equal(x.context.getStockQuantity(k1), 0);
  assert.equal(x.context.businessData.inventory[k1].product.name, assure.name);
  assert.equal(x.context.businessData.sales.length, 1);
});

test("Switching between Stock and Selling keeps independent carts without a clear-cart prompt", () => {
  const x = createHarness();
  seedStock(x, k1, assure, 5);
  x.context.cartMode = "selling";
  x.context.currentMode = "selling";
  x.context.cart = [{ key: k1, product: assure, quantity: 2, freeQuantity: 0 }];
  x.context.saveCartToStorage = () => { x.context.modeCarts[x.context.cartMode] = { cart: x.context.cart.map(item => ({ ...item })), cartName: x.context.cartName }; };
  x.context.setBusinessMode("stocking");
  assert.equal(x.context.cart.length, 0);
  assert.equal(x.context.cartMode, "stocking");
  assert.equal(x.context.modeCarts.selling.cart[0].quantity, 2);
  x.context.cart = [{ key: "stock-item", product: { ...assure, name: "Stock item" }, quantity: 4, freeQuantity: 0 }];
  x.context.setBusinessMode("selling");
  assert.equal(x.context.cart.length, 1);
  assert.equal(x.context.cart[0].quantity, 2);
  x.context.setBusinessMode("stocking");
  assert.equal(x.context.cart.length, 1);
  assert.equal(x.context.cart[0].quantity, 4);
  assert.equal(x.alerts.length, 0);
});

test("Sale totals keep free quantities excluded while the dealer is viewing the Stock tab", () => {
  const x = createHarness();
  x.context.cartMode = "selling";
  x.context.currentMode = "stocking";
  const totals = x.context.calculateCartTotals([{ key: k1, product: assure, quantity: 3, freeQuantity: 1 }]);
  assert.equal(totals.totalQuantity, 3);
  assert.equal(totals.totalDP, 146);
  assert.ok(Math.abs(totals.totalPV - 3.98) < 0.001);
});

test("Increasing a sale cart quantity while viewing Stock still enforces actual stock limits", () => {
  const x = createHarness();
  seedStock(x, k1, assure, 2);
  x.context.cartMode = "selling";
  x.context.currentMode = "stocking";
  x.context.saleType = "actual";
  x.context.cart = [{ key: k1, product: assure, quantity: 2, freeQuantity: 0 }];
  x.context.changeCartQuantity(k1, 1);
  assert.equal(x.context.cart[0].quantity, 2);
  assert.match(x.alerts.at(-1), /available stock/);
});

test("Editing Actual Sale applies only the inventory difference", () => {
  const x = createHarness();
  const sale = addSale(x, "actual", 3, 1);
  const c = x.context;
  c.editingSaleId = sale.id;
  c.saleType = "actual";
  c.cart = [{ key: k1, product: assure, quantity: 2, freeQuantity: 0 }];
  c.postSale();
  assert.equal(c.getStockQuantity(k1), 8);
  assert.equal(c.businessData.sales[0].total, 146);
  assert.equal(c.businessData.sales[0].revisions.length, 1);
});

test("Changing Actual Sale to Record Sale returns the previously deducted units", () => {
  const x = createHarness();
  const sale = addSale(x, "actual", 3, 1);
  const c = x.context;
  assert.equal(c.getStockQuantity(k1), 7);
  c.editingSaleId = sale.id;
  c.saleType = "record";
  c.cart = [{ key: k1, product: assure, quantity: 2, freeQuantity: 0 }];
  x.$("saleDateInput").value = "2026-11-20T14:35";
  c.postSale();
  assert.equal(c.getStockQuantity(k1), 10);
  assert.equal(c.businessData.sales[0].saleType, "record");
});

test("Changing Record Sale to Actual Sale deducts the new quantities", () => {
  const x = createHarness();
  const sale = addSale(x, "record", 2, 0);
  const c = x.context;
  assert.equal(c.getStockQuantity(k1), 10);
  c.editingSaleId = sale.id;
  c.saleType = "actual";
  c.cart = [{ key: k1, product: assure, quantity: 3, freeQuantity: 1 }];
  c.postSale();
  assert.equal(c.getStockQuantity(k1), 7);
  assert.equal(c.businessData.sales[0].saleType, "actual");
});

test("Deleting Actual Sale restores all paid and free units", () => {
  const x = createHarness();
  const sale = addSale(x, "actual", 3, 1);
  x.context.deleteSale(sale.id);
  assert.equal(x.context.getStockQuantity(k1), 10);
  assert.equal(x.context.businessData.sales.length, 0);
});

test("Deleting Record Sale leaves stock unchanged", () => {
  const x = createHarness();
  const sale = addSale(x, "record", 3, 1);
  x.context.deleteSale(sale.id);
  assert.equal(x.context.getStockQuantity(k1), 10);
  assert.equal(x.context.businessData.sales.length, 0);
});

test("Daily and monthly totals include both sale types and use recorded sale dates", () => {
  const x = createHarness();
  const c = x.context;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10).toISOString();
  const otherDay = now.getDate() === 1 ? 2 : 1;
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), otherDay, 10).toISOString();
  c.businessData.sales = [
    { id: "a", createdAt: today, saleDate: today, saleType: "actual", total: 100, items: [] },
    { id: "b", createdAt: today, saleDate: today, saleType: "record", total: 50, items: [] },
    { id: "c", createdAt: thisMonth, saleDate: thisMonth, saleType: "record", total: 25, items: [] }
  ];
  c.renderSalesOverview();
  assert.equal(x.$("salesTodayValue").textContent, "₹150.00");
  assert.equal(x.$("salesMonthValue").textContent, "₹175.00");
  c.businessData.sales = c.businessData.sales.filter(s => s.id !== "b");
  c.renderSalesOverview();
  assert.equal(x.$("salesTodayValue").textContent, "₹100.00");
});

test("Sale history shows type, payment status, total quantity, amount and PV", () => {
  const x = createHarness();
  addSale(x, "record", 3, 1);
  x.context.renderSalesHistory();
  const htmlOut = x.$("salesHistoryList").innerHTML;
  assert.match(htmlOut, /Record Sale/);
  assert.match(htmlOut, /3 total quantity/);
  assert.match(htmlOut, /Amount sold:/);
  assert.match(htmlOut, /Total PV:/);
  assert.match(htmlOut, /Payment: PAID/);
});

test("Seven-day edit restriction is retained", () => {
  const x = createHarness();
  const sale = addSale(x, "actual", 2, 0);
  x.context.businessData.sales[0].createdAt = new Date(Date.now() - 8 * 86400000).toISOString();
  x.context.editingSaleId = sale.id;
  x.context.cart = [{ key: k1, product: assure, quantity: 1, freeQuantity: 0 }];
  const before = x.context.getStockQuantity(k1);
  x.context.postSale();
  assert.equal(x.context.getStockQuantity(k1), before);
  assert.match(x.alerts.at(-1), /7 days/);
});


test("Sale cart uses compact sale-type toggle, checkout wording, and no direct stock controls", () => {
  assert.match(html, /SALE CART/);
  assert.match(html, /sale-type-toggle/);
  assert.match(html, /CHECK OUT ACTUAL SALE/);
  assert.match(html, /CHECK OUT RECORD SALE/);
  assert.doesNotMatch(html, /data-stock-delta|data-stock-key|stock-quantity-controls/);
  assert.match(html, /stock-quantity-value/);
  assert.match(html, /id="clearStockBtn"/);
  assert.doesNotMatch(html, /id="saveCartBtn"/);
  assert.doesNotMatch(html, /id="viewSavedBtn"/);
  assert.doesNotMatch(html, /Switching modes will clear it/);
});

test("Every static event-listener target is present in the HTML or generated UI markup", () => {
  const declaredIds = new Set([...html.matchAll(/id=["']([^"']+)["']/g)].map(match => match[1]));
  const listenerTargets = [...html.matchAll(/\$\(["']([^"']+)["']\)\.addEventListener/g)].map(match => match[1]);
  const missingTargets = [...new Set(listenerTargets.filter(id => !declaredIds.has(id)))];
  assert.deepEqual(missingTargets, []);
  assert.doesNotMatch(html, /\$\(["']savedList["']\)\.addEventListener/);
});

test("Stock List retains five-entry viewport while histories use five-entry scroll chaining", () => {
  assert.match(html, /limitListToFive\(el\)/);
  assert.match(html, /limitListTo\(el,5,"auto"\)/);
  assert.match(html, /function limitListTo\(el,visibleCount,overscrollBehavior="contain"\)/);
  const x = createHarness();
  const children = Array.from({ length: 7 }, (_, i) => ({
    getBoundingClientRect: () => ({ top: i * 58, bottom: i * 58 + 50 })
  }));
  const list = { children, style: {}, scrollTop: 116 };
  x.context.limitListToFive(list);
  assert.equal(list.style.maxHeight, "282px");
  assert.equal(list.style.overflowY, "auto");
  assert.equal(list.style.overscrollBehavior, "contain");
  assert.equal(list.style.scrollbarGutter, "stable");
  assert.equal(list.scrollTop, 116);
  x.context.limitListTo(list, 5, "auto");
  assert.equal(list.style.overscrollBehavior, "auto");
});

test("Stock-In and Sale carts show six entries and scroll only inside the product area", () => {
  const x = createHarness();
  const children = Array.from({ length: 9 }, (_, i) => ({
    getBoundingClientRect: () => ({ top: i * 52, bottom: i * 52 + 45 })
  }));
  const list = { children, style: {}, scrollTop: 104 };
  x.context.limitListTo(list, 6, "contain");
  assert.equal(list.style.maxHeight, "305px");
  assert.equal(list.style.overflowY, "auto");
  assert.equal(list.style.overscrollBehavior, "contain");
  assert.equal(list.scrollTop, 104);
  assert.match(html, /limitListTo\(list,6,"contain"\)/);
  assert.match(html, /\.cart-list\{gap:5px;margin-top:9px\}\.cart-item\{padding:7px 9px;gap:8px\}/);
  assert.match(html, /--font-cart-product:16px;\s*--font-cart-details:14px/);
});

test("Stock-in History shows five compact summaries with expandable alphabetized products", () => {
  assert.ok(businessSource.includes("function renderStockHistory()"));
  assert.match(businessSource, /limitListTo\(el,5,"auto"\)/);
  assert.match(businessSource, /class="history-summary-toggle" data-history-toggle aria-expanded="false"/);
  assert.match(businessSource, /class="history-detail" id=.*hidden/);
  assert.ok(html.includes('$("stockHistoryList").addEventListener("click",handleHistoryToggle);'));
  assert.match(businessSource, /\.sort\(\(a,b\)=>String\(a\?\.product\?\.name/);
});

test("Stock products are sorted alphabetically without case sensitivity", () => {
  const x = createHarness();
  const rows = [
    ["z", { product: { name: "zeta" } }],
    ["b", { product: { name: "beta" } }],
    ["a", { product: { name: "Alpha" } }]
  ];
  rows.sort(x.context.compareProductEntriesByName);
  assert.deepEqual(rows.map(row => row[1].product.name), ["Alpha", "beta", "zeta"]);
});

test("Lists with five or fewer entries do not get an unnecessary scrollbar", () => {
  const x = createHarness();
  const list = {
    children: Array.from({ length: 5 }, (_, i) => ({
      getBoundingClientRect: () => ({ top: i * 58, bottom: i * 58 + 50 })
    })),
    style: { maxHeight: "999px" }, scrollTop: 0
  };
  x.context.limitListToFive(list);
  assert.equal(list.style.maxHeight, "");
  assert.equal(list.style.overflowY, "visible");
});

test("Legacy sales migrate as Actual Sale and obsolete payment/refund fields are removed", () => {
  const x = createHarness();
  const oldDate = "2026-11-01T12:00:00.000Z";
  const migrated = x.context.normalizeBusinessData({
    schemaVersion: 1, inventory: {}, stockIns: [],
    sales: [{ id: "legacy", createdAt: oldDate, total: 10, items: [], payments: [{ amount: 10 }], refunds: [] }]
  });
  assert.equal(migrated.sales[0].saleType, "actual");
  assert.equal(migrated.sales[0].saleDate, oldDate);
  assert.equal("payments" in migrated.sales[0], false);
  assert.equal("refunds" in migrated.sales[0], false);
});

test("Business and cart backup schemas validate; negative stock is rejected", () => {
  const x = createHarness();
  assert.equal(x.context.validBusinessData(x.context.businessData), true);
  assert.equal(x.context.validCartPayload({ cart: [{ product: assure, quantity: 1 }] }), true);
  assert.equal(x.context.validSavedCartPayload([{ id: "saved-1", cart: [{ product: assure, quantity: 1 }] }]), true);
  const invalid = { ...x.context.businessData, inventory: { [k1]: { product: assure, quantity: -1 } } };
  assert.equal(x.context.validBusinessData(invalid), false);
});

test("Backup validation rejects negative free and saved-cart quantities", () => {
  const x = createHarness();
  assert.equal(x.context.validCartPayload({ cart: [{ product: assure, quantity: 1, freeQuantity: -1 }] }), false);
  assert.equal(x.context.validSavedCartPayload([{ id: "saved-bad", cart: [{ product: assure, quantity: -2 }] }]), false);
});

test("Failed stock-in storage write preserves stock and the cart", () => {
  const x = createHarness();
  x.context.cart = [{ key: k1, product: assure, quantity: 3, freeQuantity: 0 }];
  x.setFailStorageWrites(true);
  x.context.postStockIn();
  assert.equal(x.context.getStockQuantity(k1), 0);
  assert.equal(x.context.businessData.stockIns.length, 0);
  assert.equal(x.context.cart.length, 1);
});

test("Failed sale storage write preserves inventory, sales and the cart", () => {
  const x = createHarness();
  seedStock(x, k1, assure, 5);
  x.context.currentMode = "selling";
  x.context.saleType = "actual";
  x.context.cart = [{ key: k1, product: assure, quantity: 2, freeQuantity: 0 }];
  x.setFailStorageWrites(true);
  x.context.postSale();
  assert.equal(x.context.getStockQuantity(k1), 5);
  assert.equal(x.context.businessData.sales.length, 0);
  assert.equal(x.context.cart.length, 1);
});



test("Available stock picker subtracts the current sale cart without mutating inventory", () => {
  const x = createHarness();
  seedStock(x, k1, assure, 5);
  x.context.cart = [{ key: k1, product: assure, quantity: 2, freeQuantity: 0 }];
  assert.equal(x.context.getAvailableStockForCart(k1), 3);
  assert.equal(x.context.getStockQuantity(k1), 5);
  x.context.cart[0].quantity = 5;
  assert.equal(x.context.getAvailableStockForCart(k1), 0);
  assert.equal(x.context.getStockQuantity(k1), 5);
});

test("Sale checkout records paid or unpaid status", () => {
  const paid = createHarness();
  seedStock(paid, k1, assure, 5);
  paid.context.cart = [{ key: k1, product: assure, quantity: 1, freeQuantity: 0 }];
  paid.context.deferPaymentChoice = true;
  paid.context.confirm = () => true;
  paid.context.postSale();
  paid.context.document.listeners.get("created:click")({ target: { closest: () => ({ dataset: { paymentChoice: "paid" } }) } });
  assert.equal(paid.context.businessData.sales[0].paymentStatus, "paid");

  const unpaid = createHarness();
  seedStock(unpaid, k1, assure, 5);
  unpaid.context.cart = [{ key: k1, product: assure, quantity: 1, freeQuantity: 0 }];
  unpaid.context.deferPaymentChoice = true;
  unpaid.context.postSale();
  unpaid.context.document.listeners.get("created:click")({ target: { closest: () => ({ dataset: { paymentChoice: "unpaid" } }) } });
  assert.equal(unpaid.context.businessData.sales[0].paymentStatus, "unpaid");

  const unspecified = createHarness();
  seedStock(unspecified, k1, assure, 5);
  unspecified.context.cart = [{ key: k1, product: assure, quantity: 1, freeQuantity: 0 }];
  unspecified.context.deferPaymentChoice = true;
  unspecified.context.postSale();
  unspecified.context.document.listeners.get("created:click")({ target: { closest: () => ({ dataset: { paymentChoice: "unknown" } }) } });
  assert.equal(unspecified.context.businessData.sales[0].paymentStatus, "unknown");
});

test("Legacy sales keep payment status unknown rather than being marked paid or unpaid", () => {
  const x = createHarness();
  const migrated = x.context.normalizeBusinessData({
    schemaVersion: 1, inventory: {}, stockIns: [],
    sales: [{ id: "legacy-payment", createdAt: "2026-11-01T12:00:00.000Z", total: 10, items: [] }]
  });
  assert.equal(migrated.sales[0].paymentStatus, "unknown");
});

test("Sale UI uses product-style available-stock rows and an unpaid-sales counter", () => {
  assert.match(html, /id="saleStockPickerToggle"/);
  assert.match(html, /id="saleStockResults"/);
  assert.match(html, /class="manual-search-result"[^>]*role="option" data-sale-stock-key/);
  assert.match(html, /stock-picker-panel/);
  assert.match(html, /#saleStockResults \.manual-search-result/);
  assert.match(html, /isn't available to add/);
  assert.match(html, /data-payment-choice="paid">PAID/);
  assert.match(html, /data-payment-choice="unpaid">UNPAID/);
  assert.match(html, /data-payment-choice="unknown">NOT SPECIFIED/);
  assert.doesNotMatch(html, /data-payment-choice="cancel"|sale-payment-cancel/);
  assert.match(html, /sale-payment-panel/);
  assert.doesNotMatch(html, /confirm\("Has this sale been paid/);
  assert.match(html, /id="unpaidSalesFilterBtn"/);
  assert.match(html, /UNPAID SALES:/);
  assert.match(html, /Payment: /);
});

test("Selling mode starts on Product List and opens Sale History only when selected", () => {
  assert.match(html, /id="productListSection" class="product-list-section"/);
  assert.match(html, /class="selling-view-nav business-actions hidden" id="sellingViewNav"/);
  assert.match(html, /id="showProductListBtn" class="active">PRODUCT LIST/);
  assert.match(html, /id="showSaleHistoryBtn">SALE HISTORY/);
  assert.match(html, /section\.id="salesHistorySection";section\.className="sale-history-section hidden"/);
  assert.match(html, /function showSellingView\(view\)/);
  assert.match(html, /\$\("productListSection"\)\.classList\.toggle\("hidden",showHistory\)/);
  assert.match(html, /\$\("salesHistorySection"\)\.classList\.toggle\("hidden",!showHistory\)/);
  assert.match(html, /\$\("showProductListBtn"\)\.addEventListener\("click",\(\)=>showSellingView\("products"\)\)/);
  assert.match(html, /\$\("showSaleHistoryBtn"\)\.addEventListener\("click",\(\)=>showSellingView\("history"\)\)/);
  assert.match(html, /\$\("salesHistorySection"\)\.classList\.add\("hidden"\)/);
});

test("Stock List and Stock-In History start hidden and open exclusively", () => {
  assert.match(html, /class="business-list hidden" id="stockList"/);
  assert.match(html, /class="business-list hidden" id="stockHistoryList"/);
  assert.match(html, /history\.classList\.add\("hidden"\);list\.classList\.toggle\("hidden",!opening\)/);
  assert.match(html, /list\.classList\.add\("hidden"\);history\.classList\.toggle\("hidden",!opening\)/);
});

test("Stock-in and sale carts are persisted independently", () => {
  assert.match(html, /modeCarts = \{stocking:\{cart:\[\],cartName:""\},selling:\{cart:\[\],cartName:""\}\}/);
  assert.match(html, /carts:modeCarts/);
  assert.match(html, /const draft=modeCarts\[requested\]/);
});

test("Sale history layout has side-by-side checkout and clear-cart actions", () => {
  assert.match(html, /sale-checkout-actions/);
  assert.match(html, /CLEAR SALE CART/);
  assert.match(html, /CHECK OUT SALE/);
  assert.match(html, /clearButton\.addEventListener\("click"/);
});
test("Sale history shows five compact summaries, expands product details, and sorts newest first", () => {
  assert.match(businessSource, /records=\[\.\.\.\(businessData\.sales\|\|\[\]\)\]\.sort\(\(a,b\)=>new Date\(b\.saleDate\|\|b\.createdAt\)/);
  assert.match(businessSource, /limitListTo\(el,5,"auto"\)/);
  assert.match(businessSource, /class="history-summary-toggle" data-history-toggle aria-expanded="false"/);
  assert.match(businessSource, /class="history-detail" id=.*hidden/);
  assert.match(businessSource, /function handleHistoryToggle\(event\)/);
  assert.ok(html.includes('$("salesHistoryList").addEventListener("click",handleHistoryToggle);'));
  assert.match(businessSource, /data-sale-action="edit"/);
  assert.match(businessSource, /data-sale-action="delete"/);
});
test("Stock-in history sorts newest first and products alphabetically", () => {
  assert.match(businessSource, /stockIns\|\|\[\]\)\]\.sort\(\(a,b\)=>new Date\(b\.createdAt\)/);
  assert.match(businessSource, /\(r\.items\|\|\[\]\)\]\.sort\(\(a,b\)=>String\(a\?\.product\?\.name/);
});

test("Manual search stock status reflects dealer inventory quantities", () => {
  assert.match(html, /manual-search-stock\.in-stock/);
  assert.match(html, /manual-search-stock\.out-of-stock/);
  assert.match(html, /manual-search-result-content/);
  assert.match(html, /name\.textContent = product\.name/);
  assert.match(html, /stock\.textContent = stockStatus/);

  const start = html.indexOf("function getManualProductStockStatus(product)");
  const end = html.indexOf("\nfunction renderManualProductSearch()", start);
  assert.ok(start >= 0 && end > start, "Could not locate manual search stock-status helper");
  const context = {
    businessData: {
      inventory: {
        "assure enchant": { quantity: 4 },
        "assure aloe gel": { quantity: 0 },
        "assure face wash": { quantity: -2 }
      }
    },
    normalizeText: value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\\s+/g, " ").trim()
  };
  vm.runInNewContext(html.slice(start, end), context);
  assert.equal(context.getManualProductStockStatus({ name: "Assure Enchant" }), "In-stock");
  assert.equal(context.getManualProductStockStatus({ name: "Assure Aloe Gel" }), "Out of stock");
  assert.equal(context.getManualProductStockStatus({ name: "Assure Face Wash" }), "Out of stock");
  assert.equal(context.getManualProductStockStatus({ name: "Unknown Product" }), "Out of stock");
});

test("Manual product search matches word prefixes only, prioritizes exact names, and sorts alphabetically", () => {
  assert.ok(html.indexOf('class="manual-search-panel"') < html.indexOf('class="camera-scanner-area hidden"'));
  assert.match(html, /grid-template-columns:minmax\(0,4fr\) minmax\(0,1fr\)/);
  assert.match(html, /addEventListener\("input", renderManualProductSearch\)/);
  assert.match(html, /id="showCameraScannerBtn"[^>]*>[\s\S]*?SCAN/);
  assert.match(html, /id="cameraScannerArea" class="camera-scanner-area hidden"/);
  assert.match(html, /handleCameraScannerToggle/);
  assert.match(html, /textContent = "CLOSE"/);
  assert.match(html, /textContent = "SCAN"/);
  assert.match(html, /id="cameraStopConfirmDialog"/);
  assert.match(html, /id="confirmCameraStopBtn">STOP CAMERA/);
  assert.match(html, /id="cancelCameraCloseBtn">CANCEL/);
  assert.match(html, /Select product by SEARCH\/SCAN/);
  assert.doesNotMatch(html, /Point the camera at a product/);

  const closeStart = html.indexOf("function hideCameraScannerArea()");
  const closeEnd = html.indexOf("\nfunction stopCamera(updateStatus", closeStart);
  assert.ok(closeStart >= 0 && closeEnd > closeStart, "Could not locate camera close handlers");
  const cameraElements = new Map();
  const cameraStopCount = { value: 0 };
  const cameraContext = {
    cameraCloseAfterStart: false,
    startingCamera: false,
    stream: null,
    $ (id) {
      const elements = cameraElements;
      if (!elements.has(id)) {
        const classes = new Set(id === "cameraScannerArea" ? ["hidden"] : []);
        elements.set(id, {
          textContent: "",
          attrs: {},
          showModal() { this.modalOpen = true; },
          close() { this.modalOpen = false; },
          classList: {
            contains: value => classes.has(value),
            add: value => classes.add(value),
            remove: value => classes.delete(value)
          },
          setAttribute: (key, value) => { elements.get(id).attrs[key] = value; }
        });
      }
      return elements.get(id);
    },
    stopCamera: () => { cameraStopCount.value++; },
    console
  };
  vm.runInNewContext(html.slice(closeStart, closeEnd), cameraContext);
  cameraContext.handleCameraScannerToggle();
  assert.equal(cameraContext.$("cameraScannerArea").classList.contains("hidden"), false);
  assert.equal(cameraContext.$("showCameraScannerBtn").textContent, "CLOSE");
  cameraContext.handleCameraScannerToggle();
  assert.equal(cameraContext.$("cameraScannerArea").classList.contains("hidden"), true);
  assert.equal(cameraContext.$("showCameraScannerBtn").textContent, "SCAN");

  cameraContext.handleCameraScannerToggle();
  cameraContext.stream = { getTracks: () => [{ readyState: "live" }] };
  cameraContext.handleCameraScannerToggle();
  assert.equal(cameraContext.$("cameraScannerArea").classList.contains("hidden"), false);
  assert.equal(cameraContext.$("cameraStopConfirmDialog").modalOpen, true);
  cameraContext.confirmCameraScannerClose();
  assert.equal(cameraStopCount.value, 1);
  assert.equal(cameraContext.$("cameraScannerArea").classList.contains("hidden"), true);

  cameraContext.handleCameraScannerToggle();
  cameraContext.stream = { getTracks: () => [{ readyState: "ended" }] };
  cameraContext.handleCameraScannerToggle();
  assert.equal(cameraStopCount.value, 2);
  assert.equal(cameraContext.$("cameraScannerArea").classList.contains("hidden"), true);
  assert.match(html, /selectManualProduct\(product\)/);
  assert.doesNotMatch(html, /manualProductSelectBtn|confirmManualProductSelection/);
  assert.match(html, /limitListTo\(results, 5, "contain"\)/);
  assert.match(html, /overscroll-behavior:contain/);
  assert.match(html, /let currentMode = "selling"/);
  assert.match(html, /setBusinessMode\(cart.length \? cartMode : "selling"\)/);
  assert.match(html, /id="sellingModeBtn" class="active"/);

  const start = html.indexOf("function findManualProductMatches(query)");
  const end = html.indexOf("\nfunction renderManualProductSearch()", start);
  assert.ok(start >= 0 && end > start, "Could not locate manual product matching function");
  const context = {
    products: [
      { name: "Aloe Vera Vestige Gel" },
      { name: "Vestige Aloe Vera Gel" },
      { name: "Best Vestige Shampoo" },
      { name: "Vespa Body Lotion" },
      { name: "Assure Enchant" },
      { name: "Vestige Face Wash" },
      { name: "Ves" }
    ],
    normalizeText: value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim()
  };
  vm.runInNewContext(html.slice(start, end), context);
  const names = JSON.parse(JSON.stringify(
    context.findManualProductMatches("ves").map(item => item.name)
  ));
  assert.deepEqual(names, [
    "Ves",
    "Aloe Vera Vestige Gel",
    "Best Vestige Shampoo",
    "Vespa Body Lotion",
    "Vestige Aloe Vera Gel",
    "Vestige Face Wash"
  ]);
  const multiWordNames = JSON.parse(JSON.stringify(
    context.findManualProductMatches("ves gel").map(item => item.name)
  ));
  assert.deepEqual(multiWordNames, [
    "Aloe Vera Vestige Gel",
    "Vestige Aloe Vera Gel"
  ]);
});

test("Dynamically-created Sale History controls are attached after selling navigation before listeners bind", () => {
  const sectionInsert = html.indexOf('$("sellingViewNav").insertAdjacentElement("afterend",section)');
  const saleShareListener = html.indexOf('$("shareSaleHistoryBtn").addEventListener');
  const stockShareListener = html.indexOf('$("shareStockHistoryBtn").addEventListener');
  assert.ok(sectionInsert >= 0, "Sale History section must be inserted below the Selling navigation");
  assert.ok(saleShareListener > sectionInsert, "Sale History share button listener must be bound after insertion");
  assert.ok(stockShareListener > sectionInsert, "Stock-in share button listener must be bound after insertion");
});

test("Sale and Stock-in histories expose individual and date-range PDF sharing", () => {
  assert.match(html, /id="shareStockHistoryBtn"/);
  assert.match(html, /id="shareSaleHistoryBtn"/);
  assert.match(html, /data-history-share="stock"/);
  assert.match(html, /data-history-share="sale"/);
  assert.match(html, /id="historyShareFrom"/);
  assert.match(html, /id="historyShareTo"/);
  assert.match(html, /async function shareHistoryPdf/);
  assert.match(html, /navigator\.share/);
  assert.match(html, /doc\.output\("blob"\)/);
  assert.match(html, /historyLocalDate\(d\)>=range\.from&&historyLocalDate\(d\)<=range\.to/);
});

test("Sale History typography matches the larger Stock-in History details", () => {
  assert.match(html, /\.sale-history-list \.history-card strong\{font-size:15px\}/);
  assert.match(html, /\.sale-history-list \.history-card small\{font-size:13px\}/);
  assert.match(html, /\.sale-history-list \.history-detail\{font-size:15px;line-height:1\.6/);
});

(async () => {
  for (const result of results) {
    console.log((result.status === "PASS" ? "PASS" : "FAIL") + "  " + result.name + (result.error ? " — " + result.error : ""));
  }
  const failed = results.filter(r => r.status === "FAIL");
  console.log("\n" + (results.length - failed.length) + "/" + results.length + " synchronous tests passed");
  const asyncStart = results.length;
  const asyncTests = [
    ["Backup import restores inventory, sales and cart storage", async () => {
      const x = createHarness();
      const payload = {
        app: "Product Scanner Vestige", backupVersion: 1,
        businessData: { schemaVersion: 1, inventory: { [k1]: { product: assure, quantity: 4 } }, stockIns: [], sales: [] },
        activeCart: { cartName: "Draft", cart: [{ key: k1, product: assure, quantity: 1, freeQuantity: 0 }] },
        savedCarts: [{ id: "saved-1", cart: [{ key: k1, product: assure, quantity: 2, freeQuantity: 0 }] }]
      };
      const input = x.$("backupFile"); input.files = [{ text: async () => JSON.stringify(payload) }];
      await x.context.importBusinessBackup({ target: input });
      assert.equal(x.context.getStockQuantity(k1), 4);
      assert.ok(x.storage.has(x.context.BUSINESS_STORAGE_KEY));
      assert.ok(x.storage.has(x.context.CART_STORAGE_KEY));
      assert.ok(x.storage.has(x.context.SAVED_CARTS_STORAGE_KEY));
      assert.match(x.alerts.at(-1), /imported successfully/i);
    }],
    ["Invalid backup import leaves existing browser data untouched", async () => {
      const x = createHarness();
      x.storage.set(x.context.BUSINESS_STORAGE_KEY, "keep-business");
      x.storage.set(x.context.CART_STORAGE_KEY, "keep-cart");
      x.storage.set(x.context.SAVED_CARTS_STORAGE_KEY, "keep-saved");
      const payload = {
        app: "Product Scanner Vestige", backupVersion: 1,
        businessData: { schemaVersion: 1, inventory: { bad: { product: assure, quantity: -1 } }, stockIns: [], sales: [] },
        activeCart: { cart: [] }, savedCarts: []
      };
      const input = x.$("backupFile"); input.files = [{ text: async () => JSON.stringify(payload) }];
      await x.context.importBusinessBackup({ target: input });
      assert.equal(x.storage.get(x.context.BUSINESS_STORAGE_KEY), "keep-business");
      assert.equal(x.storage.get(x.context.CART_STORAGE_KEY), "keep-cart");
      assert.equal(x.storage.get(x.context.SAVED_CARTS_STORAGE_KEY), "keep-saved");
      assert.match(x.alerts.at(-1), /import failed/i);
    }],
    ["Partial backup import storage failure rolls back all previous values", async () => {
      const x = createHarness();
      const old = [[x.context.BUSINESS_STORAGE_KEY, "old-business"], [x.context.CART_STORAGE_KEY, "old-cart"], [x.context.SAVED_CARTS_STORAGE_KEY, "old-saved"]];
      old.forEach(([k, v]) => x.storage.set(k, v));
      const originalSet = x.context.localStorage.setItem;
      let writes = 0;
      x.context.localStorage.setItem = (k, v) => { writes++; if (writes === 2) throw new Error("QuotaExceededError"); originalSet(k, v); };
      const payload = { app: "Product Scanner Vestige", backupVersion: 1, businessData: { schemaVersion: 1, inventory: {}, stockIns: [], sales: [] }, activeCart: { cart: [] }, savedCarts: [] };
      const input = x.$("backupFile"); input.files = [{ text: async () => JSON.stringify(payload) }];
      await x.context.importBusinessBackup({ target: input });
      old.forEach(([k, v]) => assert.equal(x.storage.get(k), v));
      assert.match(x.alerts.at(-1), /import failed/i);
    }]
  ];
  for (const [name, fn] of asyncTests) {
    try { await fn(); results.push({ name, status: "PASS" }); }
    catch (error) { results.push({ name, status: "FAIL", error: error.message }); }
  }
  const asyncResults = results.slice(asyncStart);
  for (const result of asyncResults) console.log((result.status === "PASS" ? "PASS" : "FAIL") + "  " + result.name + (result.error ? " — " + result.error : ""));
  const allFailed = results.filter(r => r.status === "FAIL");
  console.log("\n" + (results.length - allFailed.length) + "/" + results.length + " total tests passed");
  if (allFailed.length) process.exitCode = 1;
})();
