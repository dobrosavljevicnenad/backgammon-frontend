// Karma does not load index.html, which supplies SockJS's browser global.
Object.assign(globalThis, { global: globalThis });
