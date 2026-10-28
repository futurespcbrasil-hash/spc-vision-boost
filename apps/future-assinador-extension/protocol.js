(() => {
  "use strict";
  const ALLOWED_COMMANDS = new Set(["PING", "LIST_CERTIFICATES", "SIGN_HASH"]);
  const ALLOWED_ALGORITHMS = new Set(["sha256", "sha384", "sha512"]);
  const MAX_HASH_BYTES = 128;
  const MAX_THUMBPRINT_LENGTH = 256;

  function isBase64(value) {
    if (typeof value !== "string" || value.length === 0 || value.length % 4 !== 0) return false;
    return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
  }

  function validateRequest(message) {
    if (!message || typeof message !== "object" || Array.isArray(message)) return { ok: false, error: "INVALID_REQUEST" };
    if (typeof message.requestId !== "string" || !/^[a-zA-Z0-9_-]{8,80}$/.test(message.requestId)) return { ok: false, error: "INVALID_REQUEST_ID" };
    if (!ALLOWED_COMMANDS.has(message.command)) return { ok: false, error: "COMMAND_NOT_ALLOWED" };

    if (message.command === "SIGN_HASH") {
      if (typeof message.thumbprint !== "string" || message.thumbprint.length < 8 ||
          message.thumbprint.length > MAX_THUMBPRINT_LENGTH || !/^[a-fA-F0-9: -]+$/.test(message.thumbprint)) {
        return { ok: false, error: "INVALID_CERTIFICATE_REFERENCE" };
      }
      if (!ALLOWED_ALGORITHMS.has(message.algorithm)) return { ok: false, error: "INVALID_ALGORITHM" };
      if (!isBase64(message.hash)) return { ok: false, error: "INVALID_HASH" };
      try {
        const decodedLength = atob(message.hash).length;
        if (decodedLength === 0 || decodedLength > MAX_HASH_BYTES) return { ok: false, error: "INVALID_HASH_LENGTH" };
      } catch {
        return { ok: false, error: "INVALID_HASH" };
      }
    }
    return { ok: true };
  }
  globalThis.FutureAssinadorProtocol = Object.freeze({ validateRequest });
})();
