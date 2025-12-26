window.PATHS = {};
async function initGlobalPaths() {
  try {
    const paths = await window.ipcAPI.invoke('get-path-constants');
    window.PATHS = paths;
    console.log('Global PATHS initialized:', window.PATHS);
  } catch (err) {
    console.error('Failed to load paths:', err);
  }
}
initGlobalPaths();
// -------------------- CÁC BIẾN TOÀN CỤC --------------------
const leftSidebar = document.querySelector('.left-sidebar');
const rightSidebar = document.querySelector('.right-sidebar');
const mainHttpItem = document.querySelector('#group-http .main-item');
const subHttpMenu = document.getElementById('sub-http');
const allSideItems = document.querySelectorAll('.side-item');
window.allSideItems = allSideItems;
const rightSidebarItems = document.querySelectorAll('.right-sidebar .side-item');
const pages = document.querySelectorAll('.content .page');
const loadedPages = new Set();
window.editorContent = {};
window.pages = pages;
document.getElementById('min-btn').addEventListener('click', () => window.winAPI.minimize());
document.getElementById('max-btn').addEventListener('click', () => window.winAPI.maximize());
document.getElementById('close-btn').addEventListener('click', () => window.winAPI.close());
const workspaceBtn = document.getElementById('workspace-btn');
const dropdown = document.getElementById('workspace-dropdown');
const modal = document.getElementById('new-workspace-modal');
let selectedFolder = '';
workspaceBtn.addEventListener('click', () => dropdown.classList.toggle('hidden'));

document.addEventListener('click', e => {
  if (!workspaceBtn.contains(e.target) && !dropdown.contains(e.target)) {
    dropdown.classList.add('hidden');
  }
});
document.getElementById('create-workspace').addEventListener('click', () => {
  dropdown.classList.add('hidden');
  modal.classList.remove('hidden');
});
document.getElementById('select-folder').addEventListener('click', async () => {
  try {
    const result = await window.ipcAPI.invoke('show-open-dialog', {
      properties: ['openDirectory'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      selectedFolder = result.filePaths[0];
      document.getElementById('folder-path').value = selectedFolder;
    }
  } catch (error) {
    showNotification('Lỗi chọn thư mục: ' + error.message, 'error');
  }
});
document.getElementById('save-btn').addEventListener('click', () => {
  const name = document.getElementById('workspace-name').value.trim();
  if (!name || !selectedFolder) {
    showNotification('Vui lòng điền đủ thông tin.', 'warning');
    return;
  }
  window.ipcAPI.send('create-workspace-file', {
    name,
    folderPath: selectedFolder,
  });
  modal.classList.add('hidden');
  resetForm();
});
document.getElementById('cancel-btn').addEventListener('click', () => {
  modal.classList.add('hidden');
  resetForm();
});
function resetForm() {
  document.getElementById('workspace-name').value = '';
  document.getElementById('folder-path').value = '';
  selectedFolder = '';
}

// -------------------- SIDEBAR NAVIGATION (LOGIC CHUYỂN TAB) --------------------

const mainItems = document.querySelectorAll('.main-item');

mainItems.forEach(mainItem => {
  mainItem.addEventListener('click', e => {
    // Tìm menu con ngay sau nó (sub-menu)
    const subMenu = mainItem.nextElementSibling;

    if (subMenu && subMenu.classList.contains('sub-menu')) {
      mainItem.classList.toggle('open');
      subMenu.classList.toggle('hidden');
    }
    e.stopPropagation();
  });
});

allSideItems.forEach(item => {
  item.addEventListener('click', async () => {
    const targetPageId = item.getAttribute('data-page');
    if (!targetPageId) return;

    allSideItems.forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');
    pages.forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(targetPageId);
    if (targetPage) targetPage.classList.add('active');

    if (!loadedPages.has(targetPageId)) {
      if (targetPageId === 'page-ws-control') {
        if (typeof loadWsControl === 'function') {
          await loadWsControl();
          loadedPages.add(targetPageId);
        }
      } else if (targetPageId === 'page-ws-state') {
        if (typeof initWsStateChart === 'function') {
          await initWsStateChart();
          loadedPages.add(targetPageId);
        }
      } else if (targetPageId === 'page-http') {
        if (typeof loadHttpTree === 'function') {
          await loadHttpTree();
          // ... các hàm init của http ...
          loadedPages.add(targetPageId);
        }
      } else if (targetPageId === 'page-admin') {
        if (window.AdminPage) {
          await window.AdminPage.activate();
          loadedPages.add(targetPageId);
        }
      }
    } else {
      if (targetPageId.startsWith('page-ws') && typeof refreshWsUI === 'function') {
        refreshWsUI();
      }
      if (targetPageId === 'page-admin' && window.AdminPage) {
        await window.AdminPage.activate();
      }
    }
  });
});

// -------------------- WORKSPACE SYSTEM (HIỆN SIDEBAR) --------------------

async function handleWorkspaceReady(name) {
  loadedPages.clear();
  await window.ipcAPI.invoke('stop-http-testcases');
  resetFullUI();
  workspaceBtn.innerHTML = `${name} <span class="arrow">▾</span>`;
  if (leftSidebar) leftSidebar.classList.remove('hidden');
  if (rightSidebar) rightSidebar.classList.remove('hidden');
  pages.forEach(p => p.classList.remove('active'));
  const introPage = document.getElementById('intro-page');
  if (introPage) introPage.classList.add('active');
  allSideItems.forEach(i => i.classList.remove('selected'));
}

document.getElementById('import-workspace').addEventListener('click', async () => {
  dropdown.classList.add('hidden');
  try {
    const result = await window.ipcAPI.invoke('import-workspace-file');
    if (result.success) {
      handleWorkspaceReady(result.name);
      showNotification(`Workspace "${result.name}" imported!`, 'success');
    }
  } catch (err) {
    showNotification('Lỗi: ' + err.message, 'error');
  }
});

window.ipcAPI.on('workspace-created', data => {
  handleWorkspaceReady(data.name);
  showNotification(`Workspace "${data.name}" created!`, 'success');
});

// -------------------- NOTIFICATION & UI HELPERS --------------------

function showNotification(message, type = 'info', duration = 3000) {
  const container = document.getElementById('notification-container');
  if (!container) return;
  const notif = document.createElement('div');
  notif.className = `notification ${type}`;
  notif.innerHTML = `
        <div class="notif-content"><span class="notif-icon">${getIcon(type)}</span><span>${message}</span></div>
        <button class="close-btn">&times;</button>
    `;
  notif.querySelector('.close-btn').addEventListener('click', () => removeNotif(notif));
  container.appendChild(notif);
  setTimeout(() => removeNotif(notif), duration);
  requestAnimationFrame(() => notif.classList.add('show'));
}

function removeNotif(notif) {
  notif.classList.remove('show');
  notif.addEventListener('transitionend', () => notif.remove(), {once: true});
}

function getIcon(type) {
  const icons = {success: '✓', error: '✕', warning: '⚠', info: 'ℹ'};
  return icons[type] || 'ℹ';
}

function resetFullUI() {
  // --- RESET TRANG HTTP SCENARIO ---
  const detailTitle = document.getElementById('detail-title');
  if (detailTitle) detailTitle.innerText = 'Select a group to view cases';

  const httpTreeRoot = document.getElementById('http-tree-root');
  if (httpTreeRoot) httpTreeRoot.innerHTML = ''; // Xóa cây thư mục cũ

  const httpDetailContent = document.getElementById('http-detail-content');
  if (httpDetailContent) httpDetailContent.innerHTML = '';

  const terminalOutput = document.getElementById('terminal-output');
  if (terminalOutput) terminalOutput.innerHTML = '<div class="terminal-prompt">> Ready...</div>';

  const selectedCount = document.getElementById('selected-count');
  if (selectedCount) selectedCount.innerText = 'Selected: 0 testcases';

  // --- RESET TRANG ADMIN (AV) ---
  if (window.AdminPage) window.AdminPage.reset();

  // --- RESET CÁC TRANG ĐANG PHÁT TRIỂN (WS, SSE, GRPC) ---
  // Nếu bạn có các container chứa dữ liệu động ở các trang này, hãy reset ở đây

  console.log('UI has been fully cleaned for new workspace.');
}
document.addEventListener('workspace-data-updated', async e => {
  console.log(`Data updated in: ${e.detail.file}. Refreshing all modules...`);
  loadedPages.clear();
  const currentPage = document.querySelector('.content .page.active');
  if (currentPage && currentPage.id === 'page-http') {
    if (typeof loadHttpTree === 'function') {
      await loadHttpTree();
      showNotification('HTTP Scenario reloaded with new data', 'info');
    }
  }
});
