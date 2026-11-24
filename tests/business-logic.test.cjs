// Isolated regression tests for dealer inventory/sales logic.
// Run from the repository root: node tests/business-logic.test.cjs
// This extracts and executes the actual business functions from index.html.

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const start = html.indexOf("function emptyBusinessData()");
const end = html.indexOf("// PRODUCT MATCHING", start);
assert.ok(start >= 0 && end > start, "Could not locate business-logic section in index.html");
const businessSource = html.slice(start, end);

function createHarness() {
  const elements = new Map();
  const alerts = [];
  const prompts = [];
  const storage = new Map();
  function $(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        value: "", textContent: "", innerHTML: "", disabled: false,
        classList: { contains: () => false, toggle: () => {}, add: () => {}, remove: () => {} },
        addEventListener: () => {}, previousElementSibling: { textContent: "" },
        querySelector: () => ({ textContent: "" }), scrollIntoView: () => {}
      });
    }
    return elements.get(id);
  }
  const context = {
    businessData: { schemaVersion: 1, inventory: {}, stockIns: [], sales: [] },
    cart: [], cartName: "", savedCarts: [], currentMode: "stocking",
    editingSaleId: null, transactionBusy: false,
    BUSINESS_STORAGE_KEY: "test-business",
    CART_STORAGE_KEY: "test-cart",
    SAVED_CARTS_STORAGE_KEY: "test-saved",
    $,
    localStorage: {
      setItem: (k, v) => storage.set(k, v),
      getItem: k => storage.has(k) ? storage.get(k) : null,
      removeItem: k => storage.delete(k)
    },
    numericValue: v => Number(v) || 0,
    formatCartMoney: v => "₹" + Number(v).toFixed(2),
    formatMoney: v => String(v),
    escapeHtml: v => String(v ?? ""),
    setStatus: () => {}, renderCart: () => {}, saveCartToStorage: () => {},
    loadCartFromStorage: () => {}, loadSavedCartsFromStorage: () => {},
    alert: message => alerts.push(String(message)),
    confirm: () => true,
    prompt: () => prompts.shift() ?? null,
    console
  };
  vm.runInNewContext(businessSource, context, { filename: "index.html#dealer-business-logic" });
  return { context, alerts, prompts, storage, $ };
}

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, status: "PASS" }); }
  catch (error) { results.push({ name, status: "FAIL", error: error.message }); }
}
function product(name, MRP, DP, pv) { return { name, MRP, DP, pv }; }

const h = createHarness();
const c = h.context;
const assure = product("ASSURE ENCHANT BODY TALK", 103, 73, 1.99);
const conditioner = product("ASSURE HAIR CONDITIONER", 330, 280, 2.9);
const k1 = "assure enchant body talk";
const k2 = "assure hair conditioner";

test("Stock-in adds quantity and creates history", () => {
  c.cart = [{ key: k1, product: assure, quantity: 5, freeQuantity: 0 }];
  c.postStockIn();
  assert.equal(c.getStockQuantity(k1), 5);
  assert.equal(c.businessData.stockIns.length, 1);
});

test("Stock valuation uses MRP, DP and PV correctly", () => {
  const totals = c.getInventoryTotals();
  assert.ok(Math.abs(totals.mrp - 515) < 0.001);
  assert.ok(Math.abs(totals.dp - 365) < 0.001);
  assert.ok(Math.abs(totals.pv - 9.95) < 0.001);
});

test("Free quantity deducts stock but not sale value", () => {
  c.currentMode = "selling";
  c.cart = [{ key: k1, product: assure, quantity: 1, freeQuantity: 1 }];
  c.postSale();
  assert.equal(c.getStockQuantity(k1), 3);
  assert.equal(c.businessData.sales[0].total, 73);
});

test("Overselling is rejected without changing stock or history", () => {
  const before = c.getStockQuantity(k1);
  c.cart = [{ key: k1, product: assure, quantity: 4, freeQuantity: 0 }];
  c.postSale();
  assert.equal(c.getStockQuantity(k1), before);
  assert.equal(c.businessData.sales.length, 1);
  assert.match(h.alerts.at(-1), /Insufficient stock/);
});

test("Unpaid, partial and paid states render correctly", () => {
  const sale = c.businessData.sales[0];
  c.renderSalesHistory();
  assert.match(h.$("salesHistoryList").innerHTML, /Unpaid/);
  h.prompts.push("30", "Cash");
  c.recordSalePayment(sale.id);
  c.renderSalesHistory();
  assert.match(h.$("salesHistoryList").innerHTML, /Partially paid/);
  h.prompts.push("43", "Online");
  c.recordSalePayment(sale.id);
  c.renderSalesHistory();
  assert.match(h.$("salesHistoryList").innerHTML, /Paid/);
  assert.equal(sale.payments.length, 2);
});

test("Additional payment cannot exceed outstanding balance", () => {
  const sale = c.businessData.sales[0];
  h.prompts.push("1");
  c.recordSalePayment(sale.id);
  assert.equal(sale.payments.length, 2);
  assert.match(h.alerts.at(-1), /cannot exceed the outstanding balance/i);
});

test("Sale editing applies only inventory delta and preserves payment history", () => {
  const sale = c.businessData.sales[0];
  c.businessData.inventory[k2] = { product: conditioner, quantity: 2 };
  c.editingSaleId = sale.id;
  c.cart = [
    { key: k1, product: assure, quantity: 1, freeQuantity: 0 },
    { key: k2, product: conditioner, quantity: 1, freeQuantity: 0 }
  ];
  c.postSale();
  assert.equal(c.getStockQuantity(k1), 4); // one returned from the original paid+free pair
  assert.equal(c.getStockQuantity(k2), 1); // one newly added
  assert.equal(sale.payments.length, 2);
  assert.equal(sale.revisions.length, 1);
  assert.equal(sale.total, 353);
});

test("Refund entries preserve method and amount", () => {
  const sale = c.businessData.sales[0];
  sale.total = 50; // simulate a revised sale total below the amount already received
  h.prompts.push("10", "Online");
  c.recordSaleRefund(sale.id);
  assert.equal(sale.refunds.length, 1);
  assert.equal(sale.refunds[0].amount, 10);
  assert.equal(sale.refunds[0].method, "Online");
});

test("Sales older than seven days cannot be edited", () => {
  const sale = c.businessData.sales[0];
  sale.createdAt = new Date(Date.now() - 8 * 86400000).toISOString();
  c.editingSaleId = sale.id;
  c.cart = [{ key: k1, product: assure, quantity: 1, freeQuantity: 0 }];
  const before = c.getStockQuantity(k1);
  c.postSale();
  assert.equal(c.getStockQuantity(k1), before);
  assert.match(h.alerts.at(-1), /7 days/);
});

test("Backup business and cart schemas validate; negative stock is rejected", () => {
  assert.equal(c.validBusinessData(c.businessData), true);
  assert.equal(c.validCartPayload({ cart: [{ product: assure, quantity: 1 }] }), true);
  assert.equal(c.validSavedCartPayload([{ id: "saved-1", cart: [{ product: assure, quantity: 1 }] }]), true);
  const invalid = { ...c.businessData, inventory: { [k1]: { product: assure, quantity: -1 } } };
  assert.equal(c.validBusinessData(invalid), false);
});

const failed = results.filter(r => r.status === "FAIL");
console.log("\nProduct Scanner Vestige — business logic tests");
for (const result of results) {
  console.log((result.status === "PASS" ? "PASS" : "FAIL") + "  " + result.name + (result.error ? " — " + result.error : ""));
}
console.log("\n" + (results.length - failed.length) + "/" + results.length + " tests passed");
if (failed.length) process.exitCode = 1;
