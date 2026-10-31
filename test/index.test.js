import { test } from "node:test";
import assert from "node:assert/strict";
import { retry } from "../src/index.js";

const noSleep = async () => {};

function flaky(failures, error = new Error("boom")) {
  let calls = 0;
  const fn = async () => {
    calls++;
    if (calls <= failures) throw error;
    return "ok";
  };
  return { fn, calls: () => calls };
}

test("returns the first success", async () => {
  const f = flaky(0);
  assert.equal(await retry(f.fn, { sleep: noSleep }), "ok");
  assert.equal(f.calls(), 1);
});

test("retries until success", async () => {
  const f = flaky(2);
  assert.equal(await retry(f.fn, { retries: 3, sleep: noSleep }), "ok");
  assert.equal(f.calls(), 3);
});

test("rethrows the last error once retries are exhausted", async () => {
  const f = flaky(10, new Error("still failing"));
  await assert.rejects(retry(f.fn, { retries: 2, sleep: noSleep }), /still failing/);
  assert.equal(f.calls(), 3);
});

test("shouldRetry can stop early", async () => {
  const f = flaky(10, Object.assign(new Error("client error"), { status: 400 }));
  await assert.rejects(retry(f.fn, { shouldRetry: (e) => e.status >= 500, sleep: noSleep }), /client error/);
  assert.equal(f.calls(), 1);
});

test("backoff grows geometrically and is capped", async () => {
  const delays = [];
  const f = flaky(4);
  await retry(f.fn, {
    retries: 4, minDelay: 100, maxDelay: 300, factor: 2, jitter: 0,
    sleep: async (ms) => delays.push(ms),
  });
  assert.deepEqual(delays, [100, 200, 300, 300]);
});

test("jitter stays within bounds and onRetry is called", async () => {
  const seen = [];
  const f = flaky(1);
  await retry(f.fn, { minDelay: 1000, jitter: 0.5, sleep: noSleep, onRetry: (e, n, d) => seen.push([n, d]) });
  assert.equal(seen.length, 1);
  assert.ok(seen[0][1] >= 500 && seen[0][1] <= 1500);
});

test("attempt number is passed to fn", async () => {
  const attempts = [];
  await retry(async (n) => { attempts.push(n); if (n < 3) throw new Error("x"); }, { sleep: noSleep });
  assert.deepEqual(attempts, [1, 2, 3]);
});

test("an aborted signal stops retrying", async () => {
  const ctrl = new AbortController();
  const f = flaky(10);
  await assert.rejects(
    retry(f.fn, { signal: ctrl.signal, sleep: async () => ctrl.abort(new Error("aborted")) }),
    /aborted/,
  );
  assert.equal(f.calls(), 1);
});
