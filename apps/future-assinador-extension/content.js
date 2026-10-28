(() => {
  "use strict";
  const NAMESPACE = "FUTURE_ASSINADOR_V1";
  const pending = new Set();

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.namespace !== NAMESPACE || message.type !== "REQUEST") return;

    const checked = FutureAssinadorProtocol.validateRequest(message);
    if (!checked.ok) {
      window.postMessage({ namespace: NAMESPACE, type: "RESPONSE",
        requestId: typeof message.requestId === "string" ? message.requestId : null,
        ok: false, error: checked.error }, window.location.origin);
      return;
    }
    if (pending.has(message.requestId)) return;
    pending.add(message.requestId);

    chrome.runtime.sendMessage({
      namespace: NAMESPACE,
      requestId: message.requestId,
      command: message.command,
      ...(message.command === "SIGN_HASH" ? {
        thumbprint: message.thumbprint, algorithm: message.algorithm, hash: message.hash
      } : {})
    }).then((response) => {
      window.postMessage({
        namespace: NAMESPACE, type: "RESPONSE", requestId: message.requestId,
        ok: Boolean(response && response.ok),
        ...(response && response.ok ? { result: response.result } : { error: response?.error || "NATIVE_HOST_UNAVAILABLE" })
      }, window.location.origin);
    }).catch(() => {
      window.postMessage({ namespace: NAMESPACE, type: "RESPONSE",
        requestId: message.requestId, ok: false, error: "NATIVE_HOST_UNAVAILABLE" }, window.location.origin);
    }).finally(() => pending.delete(message.requestId));
  });
})();
