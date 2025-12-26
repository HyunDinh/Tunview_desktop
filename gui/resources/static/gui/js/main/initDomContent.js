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

// Hàm bổ trợ để nạp Script sau khi HTML đã sẵn sàng
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function initAllModules() {
    // 1. Nạp tất cả HTML trước
    const tasks = [
        loadComponent("../../html/components/titlebar.html", ".titlebar"),
        loadComponent('../../html/components/left_sidebar.html', '.left-sidebar'),
        loadComponent('../../html/components/right_sidebar.html', '.right-sidebar'),
        loadComponent('../../html/components/modal.html', '#main_tunview_gui_body'),
        loadComponent('../../html/pages/intro.html', '#intro-page'),
        loadComponent('../../html/pages/http.html', '#page-http'),
        loadComponent('../../html/pages/admin.html', '#page-admin'),
    ];

    await Promise.all(tasks);
    console.log("[SYSTEM]: All HTML modules loaded!");

    // 2. Bây giờ mới nạp các file JS logic
    // Việc nạp ở đây đảm bảo các thẻ HTML đã tồn tại 100% trong DOM
    try {
        await loadScript("../../js/main/index.js");
        await loadScript("../../js/others/admin/admin.js");
        await loadScript("../../js/others/http/http.core.js");
        await loadScript("../../js/others/http/http.ui.js");
        
        console.log("[SYSTEM]: All JS scripts loaded and executed!");
        
        // 3. Cuối cùng mới phát sự kiện sẵn sàng
        window.dispatchEvent(new CustomEvent('domReady'));
    } catch (err) {
        console.error("[SYSTEM]: Failed to load JS scripts", err);
    }
}

initAllModules();