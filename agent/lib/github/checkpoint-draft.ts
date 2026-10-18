interface Draft {
  base: { ref: string };
  draft: boolean;
  html_url: string;
  number: number;
}

/** Narrow side effect: find or create a draft on the configured repository. */
export async function ensureCheckpointDraft(
  input: { repo: string; base: string; branch: string; summary: string },
  token: string,
  request: typeof fetch = fetch
): Promise<{ number: number; url: string }> {
  const api = `https://api.github.com/repos/${input.repo}/pulls`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const find = async (): Promise<Draft | undefined> => {
    const query = new URLSearchParams({
      head: `${input.repo.split("/")[0]}:${input.branch}`,
      state: "open",
    });
    const response = await request(`${api}?${query}`, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`Draft lookup failed (HTTP ${response.status}).`);
    }
    const drafts = (await response.json()) as Draft[];
    return drafts[0];
  };
  const result = (draft: Draft) => {
    if (!draft.draft || draft.base.ref !== input.base) {
      throw new Error("Existing PR is not a draft on the configured baseline.");
    }
    return { number: draft.number, url: draft.html_url };
  };
  const existing = await find();
  if (existing) {
    return result(existing);
  }
  const response = await request(api, {
    body: JSON.stringify({
      base: input.base,
      body: [
        "Work in progress: this draft preserves a pushed checkpoint. Independent review has not approved this work.",
        input.summary,
        "If the run stops, this draft remains for human review. Checks may be incomplete and findings may be unresolved. Consult the run trace and intake thread for the latest progress. Do not merge or mark ready without review.",
      ].join("\n\n"),
      draft: true,
      head: input.branch,
      title: `WIP: ${input.branch}`.slice(0, 250),
    }),
    headers,
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 422) {
    // A concurrent call or a retried tool may have created the same draft.
    const raced = await find();
    if (raced) {
      return result(raced);
    }
  }
  if (!response.ok) {
    throw new Error(`Draft creation failed (HTTP ${response.status}).`);
  }
  return result((await response.json()) as Draft);
}
