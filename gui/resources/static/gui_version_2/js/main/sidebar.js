window.Sidebar = {
  // Các biến cache để tái sử dụng
  elLeft: null,
  elRight: null,
  allSideItems: [],
  pages: [],
  loadedPages: new Set(),

  init() {
    this.cacheElements();
    this.bindEvents();
  },

  cacheElements() {
    this.elLeft = document.querySelector('.left-sidebar');
    this.elRight = document.querySelector('.right-sidebar');
    this.allSideItems = document.querySelectorAll('.side-item');
    this.pages = document.querySelectorAll('.content .page');

    // Đưa vào window để các module khác (như Workspace) có thể truy cập nếu cần
    window.allSideItems = this.allSideItems;
    window.loadedPages = this.loadedPages;
  },

  bindEvents() {
    // 1. Logic đóng/mở Menu cha (Accordion)
    const mainItems = document.querySelectorAll('.main-item');
    mainItems.forEach(mainItem => {
      mainItem.addEventListener('click', e => {
        const subMenu = mainItem.nextElementSibling;
        if (subMenu && subMenu.classList.contains('sub-menu')) {
          mainItem.classList.toggle('open');
          subMenu.classList.toggle('hidden');
        }
        e.stopPropagation();
      });
    });

    // 2. Logic chuyển Tab (Sidebar Navigation)
    this.allSideItems.forEach(item => {
      item.addEventListener('click', async () => {
        const targetPageId = item.getAttribute('data-page');
        if (!targetPageId) return;

        this.activateTabUI(item, targetPageId);
        await this.loadPageContent(targetPageId);
      });
    });
  },

  // Cập nhật giao diện khi click Tab
  activateTabUI(clickedItem, targetPageId) {
    this.allSideItems.forEach(i => i.classList.remove('selected'));
    clickedItem.classList.add('selected');

    this.pages.forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(targetPageId);
    if (targetPage) targetPage.classList.add('active');
  },

  // Điều phối nạp dữ liệu cho từng trang
  async loadPageContent(pageId) {
    if (!this.loadedPages.has(pageId)) {
      // --- PAGE: HTTP ---
      if (pageId === 'page-http') {
        if (window.HttpPageTreeView) {
          await window.HttpPageTreeView.loadHttpTree();
          this.loadedPages.add(pageId);
        }
      }
      // --- PAGE: ADMIN ---
      else if (pageId === 'page-admin') {
        if (window.AdminPage) {
          await window.AdminPage.activate();
          this.loadedPages.add(pageId);
        }
      }
      // --- PAGE: WS CONTROL ---
      else if (pageId === 'page-ws-control') {
        if (typeof loadWsControl === 'function') {
          await loadWsControl();
          this.loadedPages.add(pageId);
        }
      }
      // Có thể thêm các page khác ở đây...
    } else {
      // Logic xử lý khi quay lại page đã nạp (Refresh nếu cần)
      if (pageId === 'page-admin' && window.AdminPage) {
        await window.AdminPage.activate();
      }
    }
  },

  // Hàm hỗ trợ ẩn/hiện Sidebar (Dùng cho Workspace)
  toggleSidebars(show = true) {
    if (show) {
      this.elLeft?.classList.remove('hidden');
      this.elRight?.classList.remove('hidden');
    } else {
      this.elLeft?.classList.add('hidden');
      this.elRight?.classList.add('hidden');
    }
  },

  // Reset trạng thái chọn
  resetSelection() {
    this.allSideItems.forEach(i => i.classList.remove('selected'));
    this.pages.forEach(p => p.classList.remove('active'));
  },
};
