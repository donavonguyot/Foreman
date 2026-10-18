import assert from "node:assert/strict";
import test from "node:test";
import { ensureCheckpointDraft } from "../agent/lib/github/checkpoint-draft.ts";

const NOT_APPROVED = /has not approved/;
const TESTS_PENDING = /tests pending/;
const CLOSING_CLAIM = /Closes #/;
const NOT_DRAFT = /not a draft/;
const HTTP_FAILURE = /HTTP (403|500|422)/;

const input = {
  base: "main",
  branch: "factory/fixture",
  repo: "fixture/foreman",
  summary: "First useful change; tests pending.",
};
const draft = {
  base: { ref: "main" },
  draft: true,
  html_url: "https://github.com/fixture/foreman/pull/10",
  number: 10,
};
function mockRequests(responses) {
  const calls = [];
  return {
    calls,
    request(url, options) {
      calls.push({ options, url });
      const response = responses.shift();
      assert.ok(response, "unexpected HTTP request");
      return Promise.resolve(
        Response.json(response.body, { status: response.status ?? 200 })
      );
    },
  };
}

test("first push creates only a draft on the configured fork and baseline", async () => {
  const mock = mockRequests([{ body: [] }, { body: draft, status: 201 }]);
  assert.deepEqual(await ensureCheckpointDraft(input, "fake", mock.request), {
    number: 10,
    url: draft.html_url,
  });
  const [, create] = mock.calls;
  const body = JSON.parse(create.options.body);
  assert.equal(
    create.url,
    "https://api.github.com/repos/fixture/foreman/pulls"
  );
  assert.equal(body.draft, true);
  assert.equal(body.base, "main");
  assert.equal(body.head, input.branch);
  assert.match(body.body, NOT_APPROVED);
  assert.match(body.body, TESTS_PENDING);
  assert.doesNotMatch(body.body, CLOSING_CLAIM);
  for (const { options } of mock.calls) {
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
  }
});

test("repeated pushes reuse the draft without overwriting its body", async () => {
  const mock = mockRequests([{ body: [draft] }]);
  assert.equal(
    (await ensureCheckpointDraft(input, "fake", mock.request)).number,
    10
  );
  assert.equal(mock.calls.length, 1);
});

test("a competing creation or retried push finds the same draft", async () => {
  const mock = mockRequests([
    { body: [] },
    { body: {}, status: 422 },
    { body: [draft] },
  ]);
  assert.equal(
    (await ensureCheckpointDraft(input, "fake", mock.request)).number,
    10
  );
  assert.equal(mock.calls.length, 3);
});

test("ready PRs and a different base are refused without mutation", async () => {
  for (const existing of [
    { ...draft, draft: false },
    { ...draft, base: { ref: "other" } },
  ]) {
    const mock = mockRequests([{ body: [existing] }]);
    // biome-ignore lint/performance/noAwaitInLoops: Each failure fixture is checked independently.
    await assert.rejects(
      ensureCheckpointDraft(input, "fake", mock.request),
      NOT_DRAFT
    );
    assert.equal(mock.calls.length, 1);
  }
});

test("GitHub failures surface safely instead of claiming a draft exists", async () => {
  for (const responses of [
    [{ body: {}, status: 403 }],
    [{ body: [] }, { body: {}, status: 500 }],
    [{ body: [] }, { body: {}, status: 422 }, { body: [] }],
  ]) {
    const mock = mockRequests(responses);
    // biome-ignore lint/performance/noAwaitInLoops: Each failure fixture is checked independently.
    await assert.rejects(
      ensureCheckpointDraft(input, "fake", mock.request),
      HTTP_FAILURE
    );
  }
});
