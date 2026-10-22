// Keep the service worker active without forcing open CRM tabs to navigate/reload.
// The previous implementation navigated every open window during activation and
// then unregistered itself, which could discard unsaved form state and drafts.
function isWorkboxCacheForThisRegistration(name) {
  const hasWorkboxBucket = /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name);
  return hasWorkboxBucket && name.endsWith(self.registration.scope);
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const cacheNames = await caches.keys();
      const workboxCacheNames = cacheNames.filter(isWorkboxCacheForThisRegistration);
      await Promise.allSettled(workboxCacheNames.map((name) => caches.delete(name)));
    } finally {
      // Take control of existing pages, but never navigate or unregister them.
      await self.clients.claim();
    }
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL("/whatsapp", self.registration.scope).href;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = clients.find((client) => "focus" in client);
    if (existing) {
      await existing.focus();
      if ("navigate" in existing && existing.url !== target) await existing.navigate(target);
      return;
    }
    await self.clients.openWindow(target);
  })());
});
