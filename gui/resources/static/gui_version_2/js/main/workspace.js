window.Workspace = {
  selectedFolder: '',
  async init() {
    await this.initGlobalPaths();
    this.bindEvents();
    this.setupIpcListeners();
  },
  async initGlobalPaths() {
    try {
      const paths = await window.ipcAPI.invoke('get-path-constants');
      window.PATHS = paths;
    } catch (err) {
      console.error('Failed to load paths:', err);
    }
  },
  setupIpcListeners() {
    window.ipcAPI.on('workspace-created', data => {
      this.handleWorkspaceReady(data.name);
      if (window.AppUI) {
        window.AppUI.showNotification(`Workspace "${data.name}" created!`, 'success');
      }
    });
  },
  bindEvents() {
    const workspaceBtn = document.getElementById('workspace-btn');
    const dropdown = document.getElementById('workspace-dropdown');
    const modal = document.getElementById('new-workspace-modal');

    if (workspaceBtn && dropdown) {
      workspaceBtn.onclick = e => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
      };

      // Click ra ngoài để đóng dropdown
      document.addEventListener('click', e => {
        if (!workspaceBtn.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.add('hidden');
        }
      });
    }

    // Mở Modal tạo mới
    document.getElementById('create-workspace')?.addEventListener('click', () => {
      dropdown?.classList.add('hidden');
      modal?.classList.remove('hidden');
    });

    // Chọn thư mục (Dialog)
    document.getElementById('select-folder')?.addEventListener('click', async () => {
      try {
        const result = await window.ipcAPI.invoke('show-open-dialog', {
          properties: ['openDirectory'],
        });
        if (!result.canceled && result.filePaths.length > 0) {
          this.selectedFolder = result.filePaths[0];
          const folderInput = document.getElementById('folder-path');
          if (folderInput) folderInput.value = this.selectedFolder;
        }
      } catch (error) {
        window.AppUI?.showNotification('Lỗi chọn thư mục: ' + error.message, 'error');
      }
    });

    // Lưu Workspace mới
    document.getElementById('save-btn')?.addEventListener('click', () => {
      const nameInput = document.getElementById('workspace-name');
      const name = nameInput?.value.trim();
      if (!name || !this.selectedFolder) {
        window.AppUI?.showNotification('Vui lòng điền đủ thông tin.', 'warning');
        return;
      }
      window.ipcAPI.send('create-workspace-file', {
        name,
        folderPath: this.selectedFolder,
      });
      modal?.classList.add('hidden');
      this.resetForm();
    });

    // Hủy bỏ
    document.getElementById('cancel-btn')?.addEventListener('click', () => {
      modal?.classList.add('hidden');
      this.resetForm();
    });

    // Import Workspace
    document.getElementById('import-workspace')?.addEventListener('click', async () => {
      dropdown?.classList.add('hidden');
      try {
        const result = await window.ipcAPI.invoke('import-workspace-file');
        if (result.success) {
          this.handleWorkspaceReady(result.name);
          window.AppUI?.showNotification(`Workspace "${result.name}" imported!`, 'success');
        }
      } catch (err) {
        window.AppUI?.showNotification('Lỗi: ' + err.message, 'error');
      }
    });
  },
  async handleWorkspaceReady(name) {
    // 1. Xóa trạng thái các trang đã load (ép buộc reload lại data mới)
    if (window.Sidebar) window.Sidebar.loadedPages?.clear();

    // 2. Dừng các tiến trình chạy ngầm
    await window.ipcAPI.invoke('stop-http-testcases');

    // 3. Dọn dẹp UI (Gọi hàm reset tập trung)
    if (window.AppUI) window.AppUI.resetFullUI();

    // 4. Cập nhật tên Workspace lên nút bấm
    const workspaceBtn = document.getElementById('workspace-btn');
    if (workspaceBtn) workspaceBtn.innerHTML = `${name} <span class="arrow">▾</span>`;

    // 5. Hiện Sidebar (Vì mặc định khi chưa có workspace sidebar thường ẩn)
    const leftSidebar = document.querySelector('.left-sidebar');
    const rightSidebar = document.querySelector('.right-sidebar');
    leftSidebar?.classList.remove('hidden');
    rightSidebar?.classList.remove('hidden');

    // 6. Chuyển về trang Intro
    document.querySelectorAll('.content .page').forEach(p => p.classList.remove('active'));
    document.getElementById('intro-page')?.classList.add('active');

    // 7. Reset lựa chọn trên sidebar
    document.querySelectorAll('.side-item').forEach(i => i.classList.remove('selected'));

    this.loadInitialData();
  },
  resetForm() {
    const nameInput = document.getElementById('workspace-name');
    const folderInput = document.getElementById('folder-path');
    if (nameInput) nameInput.value = '';
    if (folderInput) folderInput.value = '';
    this.selectedFolder = '';
  },
  async loadInitialData() {
    if (window.HttpPageTreeView) {
      await window.HttpPageTreeView.loadHttpTree();
    } else {
        console.log("[ERROR]: window.HttpPageTreeView not yet loaded!")
    }
  },
};
