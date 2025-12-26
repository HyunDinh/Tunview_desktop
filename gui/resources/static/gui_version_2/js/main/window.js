window.WindowController = {
  init() {
    document.getElementById('min-btn')?.addEventListener('click', () => window.winAPI.minimize());
    document.getElementById('max-btn')?.addEventListener('click', () => window.winAPI.maximize());
    document.getElementById('close-btn')?.addEventListener('click', () => window.winAPI.close());
  },
};
