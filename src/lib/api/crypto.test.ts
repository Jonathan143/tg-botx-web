import { afterEach, describe, expect, it, vi } from "vitest";

import { encryptSensitiveValue } from "./crypto";

function toPem(buffer: ArrayBuffer) {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----`;
}

describe("encryptSensitiveValue", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("只向接口返回 RSA 密文，并把 nonce 与时间戳放入加密载荷", async () => {
    const pair = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"],
    );
    const publicKey = toPem(await crypto.subtle.exportKey("spki", pair.publicKey));
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              keyId: "key-1",
              publicKey,
              nonce: "nonce-1",
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
              algorithm: "RSA-OAEP-256",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    const result = await encryptSensitiveValue("admin", "super-secret-value");
    expect(result.keyId).toBe("key-1");
    expect(result.ciphertext).not.toContain("super-secret-value");

    const bytes = Uint8Array.from(atob(result.ciphertext), (character) => character.charCodeAt(0));
    const plaintext = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, pair.privateKey, bytes);
    const payload = JSON.parse(new TextDecoder().decode(plaintext)) as Record<string, string>;
    expect(payload).toMatchObject({ value: "super-secret-value", nonce: "nonce-1" });
    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);
  });
});
