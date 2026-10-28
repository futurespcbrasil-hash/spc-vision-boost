import { describe, expect, it } from "vitest";
import "../../apps/future-assinador-extension/protocol.js";

type ValidationResult = { ok: true } | { ok: false; error: string };
type ProtocolApi = { validateRequest: (message: unknown) => ValidationResult };
const protocol = (globalThis as typeof globalThis & { FutureAssinadorProtocol: ProtocolApi }).FutureAssinadorProtocol;

describe("Future Assinador extension protocol", () => {
  it("accepts a basic ping request", () => {
    expect(protocol.validateRequest({ requestId: "request_123", command: "PING" })).toEqual({ ok: true });
  });

  it("rejects commands outside the allowlist", () => {
    expect(protocol.validateRequest({ requestId: "request_123", command: "EXECUTE" })).toEqual({
      ok: false, error: "COMMAND_NOT_ALLOWED"
    });
  });

  it("rejects malformed request identifiers", () => {
    expect(protocol.validateRequest({ requestId: "x", command: "PING" })).toEqual({
      ok: false, error: "INVALID_REQUEST_ID"
    });
  });

  it("rejects a signature request with an unsupported algorithm", () => {
    expect(protocol.validateRequest({
      requestId: "request_123", command: "SIGN_HASH",
      thumbprint: "A1B2C3D4", algorithm: "md5", hash: "eA=="
    })).toEqual({ ok: false, error: "INVALID_ALGORITHM" });
  });

  it("rejects empty and oversized hashes", () => {
    expect(protocol.validateRequest({
      requestId: "request_123", command: "SIGN_HASH",
      thumbprint: "A1B2C3D4", algorithm: "sha256", hash: ""
    })).toEqual({ ok: false, error: "INVALID_HASH" });
    expect(protocol.validateRequest({
      requestId: "request_123", command: "SIGN_HASH",
      thumbprint: "A1B2C3D4", algorithm: "sha256", hash: "A".repeat(176)
    })).toEqual({ ok: false, error: "INVALID_HASH_LENGTH" });
  });
});
