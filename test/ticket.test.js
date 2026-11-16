const test = require("node:test");
const assert = require("node:assert/strict");
const { ticketsIn, firstTicket } = require("../extension/lib/ticket.js");

test("finds tickets", () => {
  assert.deepEqual(ticketsIn("feat/PAY-123-checkout"), ["PAY-123"]);
  assert.deepEqual(ticketsIn("PAY-1 and PAY-1 and OPS-22"), ["PAY-1", "OPS-22"]);
});

test("case-insensitive in branch names", () => {
  assert.deepEqual(ticketsIn("fix/pay-9-null"), ["PAY-9"]);
});

test("firstTicket prefers the first text with a ticket", () => {
  assert.equal(firstTicket("no ticket", "OPS-4 title"), "OPS-4");
  assert.equal(firstTicket("nothing"), null);
});
