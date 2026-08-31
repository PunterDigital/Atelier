import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { setTestDb, type Db } from "@/db";
import { createTestDatabase } from "@/db/testing";

import {
  fetchLatestGhcrVersion,
  getUpdateChecksEnabled,
  getUpdateStatus,
  isCloudInstance,
  resetUpdateCheckCache,
  setUpdateChecksEnabled,
} from "./updates";

function tagsResponse(tags: string[]): Response {
  return new Response(JSON.stringify({ tags }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function tokenResponse(): Response {
  return new Response(JSON.stringify({ token: "test-token" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function withEnv(values: Record<string, string | undefined>, run: () => Promise<void>) {
  const keys = Object.keys(values);
  const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const restore = () => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  };
  for (const k of keys) {
    if (values[k] === undefined) delete process.env[k];
    else process.env[k] = values[k];
  }
  return run().finally(restore);
}

describe("isCloudInstance", () => {
  it("is false for the self-hosted defaults (localhost)", async () => {
    await withEnv({ BETTER_AUTH_URL: "http://localhost:3000" }, async () => {
      expect(isCloudInstance()).toBe(false);
    });
  });

  it("is true for the managed cloud hosts (.net and .com)", async () => {
    await withEnv({ BETTER_AUTH_URL: "https://app.useclerq.net" }, async () => {
      expect(isCloudInstance()).toBe(true);
    });
    await withEnv({ BETTER_AUTH_URL: "https://app.useclerq.com" }, async () => {
      expect(isCloudInstance()).toBe(true);
    });
  });

  it("is false for a self-hosted host that merely resembles the cloud domain", async () => {
    await withEnv(
      { BETTER_AUTH_URL: "https://clerq.example.com" },
      async () => {
        expect(isCloudInstance()).toBe(false);
      },
    );
  });

  it("is false when unset or malformed", async () => {
    await withEnv({ BETTER_AUTH_URL: undefined }, async () => {
      expect(isCloudInstance()).toBe(false);
    });
    await withEnv({ BETTER_AUTH_URL: "not a url" }, async () => {
      expect(isCloudInstance()).toBe(false);
    });
  });
});

describe("fetchLatestGhcrVersion", () => {
  it("picks the highest plain release tag, ignoring latest/major.minor/sha tags", async () => {
    const fetchMock = async (url: string | URL | Request) =>
      String(url).includes("/token")
        ? tokenResponse()
        : tagsResponse([
            "1.0.0",
            "1.0",
            "sha-e137cad",
            "1.3.0",
            "1.3",
            "1.3.1",
            "latest",
            "1.2.6",
          ]);

    const result = await fetchLatestGhcrVersion({ fetch: fetchMock });
    expect(result).toBe("1.3.1");
  });

  it("returns null when the token request fails", async () => {
    const fetchMock = async () => new Response("nope", { status: 500 });
    expect(await fetchLatestGhcrVersion({ fetch: fetchMock })).toBeNull();
  });

  it("returns null when the tags request fails", async () => {
    const fetchMock = async (url: string | URL | Request) =>
      String(url).includes("/token")
        ? tokenResponse()
        : new Response("nope", { status: 404 });
    expect(await fetchLatestGhcrVersion({ fetch: fetchMock })).toBeNull();
  });

  it("returns null on a network error", async () => {
    const fetchMock = async () => {
      throw new Error("ECONNREFUSED");
    };
    expect(await fetchLatestGhcrVersion({ fetch: fetchMock })).toBeNull();
  });

  it("returns null when no tag looks like a release", async () => {
    const fetchMock = async (url: string | URL | Request) =>
      String(url).includes("/token")
        ? tokenResponse()
        : tagsResponse(["latest", "sha-abc123"]);
    expect(await fetchLatestGhcrVersion({ fetch: fetchMock })).toBeNull();
  });
});

describe("update settings + status (against a real DB)", () => {
  let pglite: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ pglite, db } = await createTestDatabase());
    setTestDb(db);
  });

  afterAll(async () => {
    setTestDb(undefined);
    await pglite.close();
  });

  afterEach(() => {
    resetUpdateCheckCache();
  });

  it("defaults to enabled before the row exists", async () => {
    expect(await getUpdateChecksEnabled()).toBe(true);
  });

  it("persists a toggle across reads", async () => {
    await setUpdateChecksEnabled(false);
    expect(await getUpdateChecksEnabled()).toBe(false);
    await setUpdateChecksEnabled(true);
    expect(await getUpdateChecksEnabled()).toBe(true);
  });

  const fetchLatest = async (url: string | URL | Request) =>
    String(url).includes("/token") ? tokenResponse() : tagsResponse(["1.3.1"]);

  it("skips the check when unconfigured (no baked-in version)", async () => {
    await withEnv(
      { CLERQ_VERSION: undefined, BETTER_AUTH_URL: "http://localhost:3000" },
      async () => {
        expect(await getUpdateStatus({ fetch: fetchLatest })).toEqual({
          checked: false,
        });
      },
    );
  });

  it("skips the check for the cloud instance even with a version baked in", async () => {
    await withEnv(
      { CLERQ_VERSION: "1.0.0", BETTER_AUTH_URL: "https://app.useclerq.net" },
      async () => {
        expect(await getUpdateStatus({ fetch: fetchLatest })).toEqual({
          checked: false,
        });
      },
    );
  });

  it("skips the check when the deployment turned it off", async () => {
    await setUpdateChecksEnabled(false);
    await withEnv(
      { CLERQ_VERSION: "1.0.0", BETTER_AUTH_URL: "http://localhost:3000" },
      async () => {
        expect(await getUpdateStatus({ fetch: fetchLatest })).toEqual({
          checked: false,
        });
      },
    );
    await setUpdateChecksEnabled(true);
  });

  it("reports an available update when GHCR has a newer release", async () => {
    await withEnv(
      { CLERQ_VERSION: "1.0.0", BETTER_AUTH_URL: "http://localhost:3000" },
      async () => {
        expect(await getUpdateStatus({ fetch: fetchLatest })).toEqual({
          checked: true,
          currentVersion: "1.0.0",
          latestVersion: "1.3.1",
          updateAvailable: true,
        });
      },
    );
  });

  it("reports no update when already on the latest release", async () => {
    await withEnv(
      { CLERQ_VERSION: "1.3.1", BETTER_AUTH_URL: "http://localhost:3000" },
      async () => {
        expect(await getUpdateStatus({ fetch: fetchLatest })).toEqual({
          checked: true,
          currentVersion: "1.3.1",
          latestVersion: "1.3.1",
          updateAvailable: false,
        });
      },
    );
  });
});
