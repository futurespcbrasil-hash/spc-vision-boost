import { describe, expect, it } from "vitest";
import "../protocol.js";

const validateRequest = globalThis.FutureAssinadorProtocol.validateRequest;

describe("Future Assinador extension protocol", () => {
  it("accepts a basic ping request", () => {
    expect(validateRequest({ requestId: "request_123", command: "PING" })).toEqual({ ok: true });
  });

  it("rejects commands outside the allowlist", () => {
    expect(validateRequest({ requestId: "request_123", command: "EXECUTE" })).toEqual({
      ok: false, error: "COMMAND_NOT_ALLOWED"
    });
  });

  it("rejects malformed request identifiers", () => {
    expect(validateRequest({ requestId: "x", command: "PING" })).toEqual({
      ok: false, error: "INVALID_REQUEST_ID"
    });
  });

  it("rejects a signature request with an unsupported algorithm", () => {
    expect(validateRequest({
      requestId: "request_123", command: "SIGN_HASH",
      thumbprint: "A1B2C3D4", algorithm: "md5", hash: "eA=="
    })).toEqual({ ok: false, error: "INVALID_ALGORITHM" });
  });

  it("rejects empty and oversized hashes", () => {
    expect(validateRequest({
      requestId: "request_123", command: "SIGN_HASH",
      thumbprint: "A1B2C3D4", algorithm: "sha256", hash: ""
    })).toEqual({ ok: false, error: "INVALID_HASH" });
    expect(validateRequest({
      requestId: "request_123", command: "SIGN_HASH",
      thumbprint: "A1B2C3D4", algorithm: "sha256", hash: "A".repeat(176)
    })).toEqual({ ok: false, error: "INVALID_HASH_LENGTH" });
  });
});
