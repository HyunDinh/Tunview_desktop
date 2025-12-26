window.AppUI = {
  /**
   * Hiển thị thông báo trên màn hình
   * @param {string} message - Nội dung thông báo
   * @param {string} type - 'success', 'error', 'warning', 'info'
   * @param {number} duration - Thời gian hiển thị (ms)
   */
  showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.innerHTML = `
        <div class="notif-content">
          <span class="notif-icon">${this._getIcon(type)}</span>
          <span>${message}</span>
        </div>
        <button class="close-btn">&times;</button>
    `;

    // Nút đóng thủ công
    notif.querySelector('.close-btn').addEventListener('click', () => this._removeNotif(notif));

    container.appendChild(notif);

    // Tự động xóa sau duration
    setTimeout(() => this._removeNotif(notif), duration);

    // Trigger hiệu ứng show (CSS transition)
    requestAnimationFrame(() => notif.classList.add('show'));
  },

  /**
   * Reset toàn bộ UI về trạng thái ban đầu (thường dùng khi đổi Workspace)
   */
  resetFullUI() {

    // 1. Reset HTTP Module
    const detailTitle = document.getElementById('detail-title');
    if (detailTitle) detailTitle.innerText = 'Select a group to view cases';

    const httpTreeRoot = document.getElementById('http-tree-root');
    if (httpTreeRoot) httpTreeRoot.innerHTML = '';

    const httpDetailContent = document.getElementById('http-detail-content');
    if (httpDetailContent) httpDetailContent.innerHTML = '';

    // 2. Reset Terminal
    const terminalOutput = document.getElementById('terminal-output');
    if (terminalOutput) terminalOutput.innerHTML = '<div class="terminal-prompt">> Ready...</div>';

    const selectedCount = document.getElementById('selected-count');
    if (selectedCount) selectedCount.innerText = 'Selected: 0 testcases';

    // 3. Reset Admin Module
    if (window.AdminPage && typeof window.AdminPage.reset === 'function') {
      window.AdminPage.reset();
    }

    // 4. Xóa cache của Sidebar để buộc các trang load lại dữ liệu mới
    if (window.Sidebar && window.Sidebar.loadedPages) {
      window.Sidebar.loadedPages.clear();
    }
  },

  // --- Các hàm hỗ trợ nội bộ (Private-like) ---

  _removeNotif(notif) {
    notif.classList.remove('show');
    notif.addEventListener('transitionend', () => notif.remove(), { once: true });
  },

  _getIcon(type) {
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    return icons[type] || 'ℹ';
  },
};

window.showNotification = (msg, type, dur) => window.AppUI.showNotification(msg, type, dur);
window.resetFullUI = () => window.AppUI.resetFullUI();
