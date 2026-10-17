self.addEventListener("push", (event) => {
  let data = { title: "ข้อความใหม่", body: "มีข้อความใหม่ถึงคุณ 💌", url: "/", force: false };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (!data.force && windows.some((client) => client.focused && client.visibilityState === "visible")) return;
    await self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: data.url }
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => client.url.includes(self.location.origin));
      return existing ? existing.focus() : clients.openWindow(url);
    })
  );
});
