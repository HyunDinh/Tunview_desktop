//#region --- Functions for Tunview Gui Bootstrapper
async function loadComponent(url, containerSelector) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error loading file: ${url}`);
    const html = await response.text();
    const container = document.querySelector(containerSelector);
    if (container) {
      container.insertAdjacentHTML('beforeend', html);
    }
  } catch (err) {
    console.error(`Warning : cannot load component from ${url}`, err);
  }
}
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
//#endregion

async function load_HTMLs() {
  await Promise.all([
    loadComponent('../../html/components/titlebar.html', '.titlebar'),
    loadComponent('../../html/components/left_sidebar.html', '.left-sidebar'),
    loadComponent('../../html/components/right_sidebar.html', '.right-sidebar'),
    loadComponent('../../html/components/modal.html', '#main_tunview_gui_body'),
    loadComponent('../../html/pages/intro.html', '#intro-page'),
    loadComponent('../../html/pages/http.html', '#page-http'),
    loadComponent('../../html/pages/admin.html', '#page-admin'),
  ]);
  console.log('[SYSTEM]: All HTML modules loaded!');
}

async function load_JSs() {
  try {
    await loadScript('../../js/main/window.js');
    await loadScript('../../js/main/workspace.js');
    await loadScript('../../js/main/sidebar.js');
    await loadScript('../../js/main/notification.js');

    await loadScript('../../js/pages/admin/admin.js');
    await loadScript('../../js/pages/http/http.core.js');
    await loadScript('../../js/pages/http/http.ui.js');

    console.log('[SYSTEM]: All JS scripts loaded!');
  } catch (err) {
    console.error('[SYSTEM]: Failed to load JS scripts', err);
    throw err;
  }
}

async function init_tunview() {
  const modules_init = [
    window.WindowController,
    window.Workspace,
    window.Sidebar,
    window.AdminPage,
    window.HttpPageUI,
    window.HttpPageTreeView,
    window.HttpPageDetail,
    window.HttpPageRunner,
  ];
  for (const mod of modules_init) {
    if (mod?.init) {
      await mod.init();
    }
  }
  console.log('[SYSTEM]: All modules initialized successfully!');
}


async function tunview_execution() {
  await load_HTMLs();
  await load_JSs();
  await init_tunview();
}

tunview_execution();
