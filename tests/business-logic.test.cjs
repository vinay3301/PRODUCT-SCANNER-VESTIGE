// Isolated regression tests for dealer inventory/sales logic.
// Run from the repository root: node tests/business-logic.test.cjs
// This extracts and executes the actual business functions from index.html.

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const start = html.indexOf("function normalizeCartItem(item)");
const end = html.indexOf("// PRODUCT MATCHING", start);
assert.ok(start >= 0 && end > start, "Could not locate business-logic section in index.html");
const businessSource = html.slice(start, end);

function createHarness() {
  const elements = new Map();
  const alerts = [];
  const prompts = [];
  const storage = new Map();
  let failStorageWrites = false;
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
      setItem: (k, v) => { if (failStorageWrites) throw new Error("QuotaExceededError"); storage.set(k, v); },
      getItem: k => storage.has(k) ? storage.get(k) : null,
      removeItem: k => storage.delete(k)
    },
    normalizeText: v => String(v || "").toLowerCase(),
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
  return { context, alerts, prompts, storage, $, setFailStorageWrites: value => { failStorageWrites = value; } };
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

test("Legacy cart free quantities migrate once into total quantity", () => {
  const x = createHarness();
  const migrated = x.context.normalizeCartItem({
    key:k1,product:assure,quantity:2,freeQuantity:1
  });
  assert.equal(migrated.quantity,3);
  assert.equal(migrated.freeQuantity,1);
  assert.equal(migrated.quantityIncludesFree,true);
  const normalizedAgain = x.context.normalizeCartItem(migrated);
  assert.equal(normalizedAgain.quantity,3);
});

test("All inline JavaScript blocks in the page have valid syntax", () => {
  const blocks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(code => code.trim());
  assert.ok(blocks.length > 0, "No inline JavaScript blocks found");
  blocks.forEach((code, index) => new vm.Script(code, { filename: "index.html inline script " + (index + 1) }));
});

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

test("Free quantity is included in total quantity and excluded from sale value", () => {
  c.currentMode = "selling";
  c.cart = [{ key: k1, product: assure, quantity: 2, freeQuantity: 1 }];
  c.postSale();
  assert.equal(c.getStockQuantity(k1), 3);
  assert.equal(c.businessData.sales[0].items[0].quantity, 1);
  assert.equal(c.businessData.sales[0].items[0].freeQuantity, 1);
  assert.equal(c.businessData.sales[0].total, 73);
});

test("One unit can be entirely free when total quantity is one", () => {
  const x = createHarness();
  x.context.currentMode = "selling";
  x.context.businessData.inventory[k1] = { product: assure, quantity: 1 };
  x.context.cart = [{ key: k1, product: assure, quantity: 1, freeQuantity: 1 }];
  x.context.postSale();
  assert.equal(x.context.getStockQuantity(k1), 0);
  assert.equal(x.context.businessData.sales[0].items[0].quantity, 0);
  assert.equal(x.context.businessData.sales[0].items[0].freeQuantity, 1);
  assert.equal(x.context.businessData.sales[0].total, 0);
});

test("Three total units with one free charge for two and deduct three", () => {
  const x = createHarness();
  x.context.currentMode = "selling";
  x.context.businessData.inventory[k1] = { product: assure, quantity: 3 };
  x.context.cart = [{ key: k1, product: assure, quantity: 3, freeQuantity: 1 }];
  x.context.postSale();
  assert.equal(x.context.getStockQuantity(k1), 0);
  assert.equal(x.context.businessData.sales[0].items[0].quantity, 2);
  assert.equal(x.context.businessData.sales[0].items[0].freeQuantity, 1);
  assert.equal(x.context.businessData.sales[0].total, 146);
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
  const saleId = c.businessData.sales[0].id;
  c.renderSalesHistory();
  assert.match(h.$("salesHistoryList").innerHTML, /Unpaid/);
  h.prompts.push("30", "Cash");
  c.recordSalePayment(saleId);
  c.renderSalesHistory();
  assert.match(h.$("salesHistoryList").innerHTML, /Partially paid/);
  h.prompts.push("43", "Online");
  c.recordSalePayment(saleId);
  c.renderSalesHistory();
  assert.match(h.$("salesHistoryList").innerHTML, /Paid/);
  assert.equal(c.businessData.sales[0].payments.length, 2);
});

test("Additional payment cannot exceed outstanding balance", () => {
  const saleId = c.businessData.sales[0].id;
  h.prompts.push("1");
  c.recordSalePayment(saleId);
  assert.equal(c.businessData.sales[0].payments.length, 2);
  assert.match(h.alerts.at(-1), /cannot exceed the outstanding balance/i);
});

test("Sale editing applies only inventory delta and preserves payment history", () => {
  const saleId = c.businessData.sales[0].id;
  c.businessData.inventory[k2] = { product: conditioner, quantity: 2 };
  c.editingSaleId = saleId;
  c.cart = [
    { key: k1, product: assure, quantity: 1, freeQuantity: 0 },
    { key: k2, product: conditioner, quantity: 1, freeQuantity: 0 }
  ];
  c.postSale();
  assert.equal(c.getStockQuantity(k1), 4); // one returned from the original paid+free pair
  assert.equal(c.getStockQuantity(k2), 1); // one newly added
  assert.equal(c.businessData.sales[0].payments.length, 2);
  assert.equal(c.businessData.sales[0].revisions.length, 1);
  assert.equal(c.businessData.sales[0].total, 353);
});

test("Refund entries preserve method and amount", () => {
  const saleId = c.businessData.sales[0].id;
  c.businessData.sales[0].total = 50; // simulate a revised sale total below the amount already received
  h.prompts.push("10", "Online");
  c.recordSaleRefund(saleId);
  assert.equal(c.businessData.sales[0].refunds.length, 1);
  assert.equal(c.businessData.sales[0].refunds[0].amount, 10);
  assert.equal(c.businessData.sales[0].refunds[0].method, "Online");
});

test("Sales older than seven days cannot be edited", () => {
  const saleId = c.businessData.sales[0].id;
  c.businessData.sales[0].createdAt = new Date(Date.now() - 8 * 86400000).toISOString();
  c.editingSaleId = saleId;
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


test("Backup validation rejects malformed payment and refund ledger entries", () => {
  const malformedPayment = JSON.parse(JSON.stringify(c.businessData));
  malformedPayment.sales[0].payments[0].amount = "not-a-number";
  assert.equal(c.validBusinessData(malformedPayment), false);
  const malformedRefund = JSON.parse(JSON.stringify(c.businessData));
  malformedRefund.sales[0].refunds[0].method = "Cheque";
  assert.equal(c.validBusinessData(malformedRefund), false);
});

test("Backup validation rejects negative free and saved-cart quantities", () => {
  assert.equal(c.validCartPayload({ cart: [{ product: assure, quantity: 1, freeQuantity: -1 }] }), false);
  assert.equal(c.validSavedCartPayload([{ id: "saved-bad", cart: [{ product: assure, quantity: -2 }] }]), false);
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
  x.context.currentMode = "selling";
  x.context.businessData.inventory[k1] = { product: assure, quantity: 5 };
  x.context.cart = [{ key: k1, product: assure, quantity: 2, freeQuantity: 0 }];
  x.setFailStorageWrites(true);
  x.context.postSale();
  assert.equal(x.context.getStockQuantity(k1), 5);
  assert.equal(x.context.businessData.sales.length, 0);
  assert.equal(x.context.cart.length, 1);
});

test("Initial payment above the sale total is rejected without posting the sale", () => {
  const x = createHarness();
  x.context.currentMode = "selling";
  x.context.businessData.inventory[k1] = { product: assure, quantity: 5 };
  x.context.cart = [{ key: k1, product: assure, quantity: 2, freeQuantity: 0 }];
  x.$("receivedNow").value = "200";
  x.$("receivedMethod").value = "Cash";
  x.context.postSale();
  assert.equal(x.context.businessData.sales.length, 0);
  assert.equal(x.context.getStockQuantity(k1), 5);
  assert.equal(x.context.cart.length, 1);
  assert.match(x.alerts.at(-1), /cannot exceed the sale total/i);
});

test("Invalid payment method is rejected without adding a ledger entry", () => {
  const x = createHarness();
  x.context.businessData.sales = [{ id: "sale-1", createdAt: new Date().toISOString(), total: 100, items: [], payments: [], refunds: [] }];
  x.prompts.push("25", "Cheque");
  x.context.recordSalePayment("sale-1");
  assert.equal(x.context.businessData.sales[0].payments.length, 0);
  assert.match(x.alerts.at(-1), /Cash or Online/i);
});

test("Refund cannot exceed the amount due or use an unsupported method", () => {
  const x = createHarness();
  x.context.businessData.sales = [{ id: "sale-1", createdAt: new Date().toISOString(), total: 50, items: [], payments: [{ id: "p1", createdAt: new Date().toISOString(), amount: 80, method: "Cash" }], refunds: [] }];
  x.prompts.push("31");
  x.context.recordSaleRefund("sale-1");
  assert.equal(x.context.businessData.sales[0].refunds.length, 0);
  assert.match(x.alerts.at(-1), /not exceeding the refund due/i);
  x.prompts.push("20", "Cheque");
  x.context.recordSaleRefund("sale-1");
  assert.equal(x.context.businessData.sales[0].refunds.length, 0);
  assert.match(x.alerts.at(-1), /Cash or Online/i);
});

test("Transaction busy guard prevents a second submission", () => {
  const x = createHarness();
  x.context.transactionBusy = true;
  x.context.cart = [{ key: k1, product: assure, quantity: 2, freeQuantity: 0 }];
  x.context.postCurrentTransaction();
  assert.equal(x.context.businessData.stockIns.length, 0);
  assert.equal(x.context.cart.length, 1);
});

const failed = results.filter(r => r.status === "FAIL");
console.log("\nProduct Scanner Vestige — business logic tests");
for (const result of results) {
  console.log((result.status === "PASS" ? "PASS" : "FAIL") + "  " + result.name + (result.error ? " — " + result.error : ""));
}
console.log("\n" + (results.length - failed.length) + "/" + results.length + " tests passed");
if (failed.length) process.exitCode = 1;


const synchronousTestCount = results.length;
async function testAsync(name, fn) {
  try { await fn(); results.push({ name, status: "PASS" }); }
  catch (error) { results.push({ name, status: "FAIL", error: error.message }); process.exitCode = 1; }
}
(async () => {
  await testAsync("Valid backup import restores business data and cart storage", async () => {
    const x = createHarness();
    const payload = {
      app: "Product Scanner Vestige", backupVersion: 1,
      businessData: { schemaVersion: 1, inventory: { [k1]: { product: assure, quantity: 4 } }, stockIns: [], sales: [] },
      activeCart: { cartName: "Draft", cart: [{ key: k1, product: assure, quantity: 1, freeQuantity: 0 }] },
      savedCarts: [{ id: "saved-1", cart: [{ key: k1, product: assure, quantity: 2, freeQuantity: 0 }] }]
    };
    const input = x.$("backupFile");
    input.files = [{ text: async () => JSON.stringify(payload) }];
    await x.context.importBusinessBackup({ target: input });
    assert.equal(x.context.getStockQuantity(k1), 4);
    assert.ok(x.storage.has(x.context.BUSINESS_STORAGE_KEY));
    assert.ok(x.storage.has(x.context.CART_STORAGE_KEY));
    assert.ok(x.storage.has(x.context.SAVED_CARTS_STORAGE_KEY));
    assert.match(x.alerts.at(-1), /imported successfully/i);
  });

  await testAsync("Invalid backup import leaves existing browser data untouched", async () => {
    const x = createHarness();
    x.storage.set(x.context.BUSINESS_STORAGE_KEY, "keep-business");
    x.storage.set(x.context.CART_STORAGE_KEY, "keep-cart");
    x.storage.set(x.context.SAVED_CARTS_STORAGE_KEY, "keep-saved");
    const payload = {
      app: "Product Scanner Vestige", backupVersion: 1,
      businessData: { schemaVersion: 1, inventory: { bad: { product: assure, quantity: -1 } }, stockIns: [], sales: [] },
      activeCart: { cart: [] }, savedCarts: []
    };
    const input = x.$("backupFile");
    input.files = [{ text: async () => JSON.stringify(payload) }];
    await x.context.importBusinessBackup({ target: input });
    assert.equal(x.storage.get(x.context.BUSINESS_STORAGE_KEY), "keep-business");
    assert.equal(x.storage.get(x.context.CART_STORAGE_KEY), "keep-cart");
    assert.equal(x.storage.get(x.context.SAVED_CARTS_STORAGE_KEY), "keep-saved");
    assert.match(x.alerts.at(-1), /import failed/i);
  });

  await testAsync("Partial backup import storage failure rolls back all previous values", async () => {
    const x = createHarness();
    const old = [
      [x.context.BUSINESS_STORAGE_KEY, "old-business"],
      [x.context.CART_STORAGE_KEY, "old-cart"],
      [x.context.SAVED_CARTS_STORAGE_KEY, "old-saved"]
    ];
    old.forEach(([k, v]) => x.storage.set(k, v));
    const originalSet = x.context.localStorage.setItem;
    let writes = 0;
    x.context.localStorage.setItem = (k, v) => {
      writes++;
      if (writes === 2) throw new Error("QuotaExceededError");
      originalSet(k, v);
    };
    const payload = {
      app: "Product Scanner Vestige", backupVersion: 1,
      businessData: { schemaVersion: 1, inventory: {}, stockIns: [], sales: [] },
      activeCart: { cart: [] }, savedCarts: []
    };
    const input = x.$("backupFile");
    input.files = [{ text: async () => JSON.stringify(payload) }];
    await x.context.importBusinessBackup({ target: input });
    old.forEach(([k, v]) => assert.equal(x.storage.get(k), v));
    assert.match(x.alerts.at(-1), /import failed/i);
  });

  const asyncResults = results.slice(synchronousTestCount);
  const asyncFailed = asyncResults.filter(r => r.status === "FAIL");
  console.log("\nBackup import integration checks");
  for (const result of asyncResults) console.log((result.status === "PASS" ? "PASS" : "FAIL") + "  " + result.name + (result.error ? " — " + result.error : ""));
  console.log("\n" + (asyncResults.length - asyncFailed.length) + "/" + asyncResults.length + " backup import checks passed");
  if (asyncFailed.length) process.exitCode = 1;
})();
