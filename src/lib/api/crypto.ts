import { apiRequest, jsonBody } from "./client";
import type { TransportKey } from "./types";

export type SensitivePurpose = "admin" | "phone" | "code" | "password";

function decodePublicKey(publicKey: string) {
  const base64 = publicKey
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeCiphertext(ciphertext: ArrayBuffer) {
  const bytes = new Uint8Array(ciphertext);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export async function encryptSensitiveValue(purpose: SensitivePurpose, value: string) {
  const transportKey = await apiRequest<TransportKey>(`/api/auth/key?purpose=${purpose}`);
  const key = await crypto.subtle.importKey(
    "spki",
    decodePublicKey(transportKey.publicKey),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
  const plaintext = new TextEncoder().encode(
    JSON.stringify({
      value,
      nonce: transportKey.nonce,
      timestamp: new Date().toISOString(),
    }),
  );
  const ciphertext = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, plaintext);

  return {
    keyId: transportKey.keyId,
    ciphertext: encodeCiphertext(ciphertext),
  };
}

export async function submitEncryptedValue<T>(
  path: string,
  purpose: SensitivePurpose,
  value: string,
) {
  const encrypted = await encryptSensitiveValue(purpose, value);
  return apiRequest<T>(path, { method: "POST", body: jsonBody(encrypted) });
}
