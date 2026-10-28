"use strict";
const NAMESPACE = "FUTURE_ASSINADOR_V1";
const NATIVE_HOST = "com.futuresolucoes.assinador";
const ALLOWED_ORIGINS = new Set([
  "https://futuresolucoes.com.br",
  "https://www.futuresolucoes.com.br",
  "https://crm.futuresolucoes.com.br"
]);
const COMMANDS = new Set(["PING", "LIST_CERTIFICATES", "SIGN_HASH"]);

function validSender(sender) {
  if (sender.id !== chrome.runtime.id || typeof sender.url !== "string") return false;
  try { return ALLOWED_ORIGINS.has(new URL(sender.url).origin); } catch { return false; }
}

function relayToNative(message) {
  return new Promise((resolve) => {
    let settled = false;
    let port;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      try { port?.disconnect(); } catch { /* port may already be closed */ }
      resolve(value);
    };
    try {
      port = chrome.runtime.connectNative(NATIVE_HOST);
      port.onMessage.addListener((response) => {
        if (!response || typeof response !== "object") return finish({ ok: false, error: "INVALID_NATIVE_RESPONSE" });
        finish(response);
      });
      port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError?.message;
        finish({ ok: false, error: error ? "NATIVE_HOST_UNAVAILABLE" : "NATIVE_HOST_DISCONNECTED" });
      });
      port.postMessage(message);
    } catch {
      finish({ ok: false, error: "NATIVE_HOST_UNAVAILABLE" });
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!validSender(sender) || !message || message.namespace !== NAMESPACE) {
    sendResponse({ ok: false, error: "ORIGIN_NOT_ALLOWED" });
    return false;
  }
  if (!COMMANDS.has(message.command)) {
    sendResponse({ ok: false, error: "COMMAND_NOT_ALLOWED" });
    return false;
  }
  const request = { protocolVersion: 1, requestId: message.requestId, command: message.command };
  if (message.command === "SIGN_HASH") {
    request.thumbprint = message.thumbprint;
    request.algorithm = message.algorithm;
    request.hash = message.hash;
  }
  relayToNative(request).then(sendResponse).catch(() => sendResponse({ ok: false, error: "NATIVE_HOST_UNAVAILABLE" }));
  return true;
});
