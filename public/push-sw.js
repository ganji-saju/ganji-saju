self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || '달빛인생 알림';
  const options = {
    body: data.body || '새로운 흐름이 도착했습니다.',
    icon: data.icon || '/globe.svg',
    badge: data.badge || '/globe.svg',
    tag: data.tag || 'moonlight-notification',
    data: {
      url: data.url || '/notifications',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
