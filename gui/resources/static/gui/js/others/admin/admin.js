window.AdminPage = {
    // --- Trạng thái nội bộ ---
    isLoaded: false,
    currentSelectedFile: null,
    editorContent: {},

    // --- Các phần tử DOM (Cache để dùng nhiều lần) ---
    get elements() {
        return {
            treeRoot: document.getElementById("tree-root"),
            fileEditor: document.getElementById("file-editor"),
            currentFileSpan: document.getElementById("current-file"),
            pageAdmin: document.getElementById("page-admin"),
            avBtn: document.getElementById("av-btn")
        };
    },

    // --- Khởi tạo (Gọi 1 lần duy nhất khi nạp file) ---
    init() {
        console.log("[SYSTEM]: Admin Module Initialized");
        this.addGlobalListeners();
    },

    // --- Điều phối hiển thị (Gọi từ index.js) ---
    async activate() {
        // Chỉ load cây thư mục nếu chưa có dữ liệu (Lazy Loading)
        if (!this.isLoaded || !this.elements.treeRoot.innerHTML) {
            await this.loadZipTree();
        }
    },

    // --- Reset khi đổi Workspace (Gọi từ index.js) ---
    reset() {
        this.isLoaded = false;
        this.currentSelectedFile = null;
        this.editorContent = {};
        if (this.elements.treeRoot) this.elements.treeRoot.innerHTML = "";
        if (this.elements.fileEditor) this.elements.fileEditor.value = "";
        if (this.elements.currentFileSpan) this.elements.currentFileSpan.textContent = "None";
    },

    // --- Core Logic ---
    async loadZipTree() {
        const { treeRoot } = this.elements;
        try {
            const workspaceInfo = await window.ipcAPI.invoke("get-workspace-info");
            if (!workspaceInfo || !workspaceInfo.success) {
                showNotification("Please open a workspace first.", "warning");
                return;
            }

            const entries = await window.ipcAPI.invoke("get-zip-entries");
            if (!entries || entries.length === 0) {
                treeRoot.innerHTML = "<li><span class='tree-node'>No files in workspace</span></li>";
                return;
            }

            const treeStructure = this.buildTreeStructure(entries);
            treeRoot.innerHTML = this.renderTree(treeStructure);
            this.addTreeEvents();
            
            this.editorContent = {}; // Clear cache khi reload tree
            this.isLoaded = true;
        } catch (err) {
            showNotification("Error loading tree: " + err.message, "error");
            treeRoot.innerHTML = "<li><span class='tree-node'>Error loading files</span></li>";
        }
    },

    buildTreeStructure(entries) {
        const root = {};
        entries.forEach((entry) => {
            const parts = entry.split("/").filter(Boolean);
            let current = root;
            parts.forEach((part, idx) => {
                if (idx === parts.length - 1 && !entry.endsWith('/')) {
                    current[part] = { type: "file", path: entry };
                } else {
                    if (!current[part]) current[part] = { type: "folder", children: {} };
                    current = current[part].children;
                }
            });
        });
        return root;
    },

    renderTree(node, currentPath = "") {
        let html = "";
        Object.entries(node).forEach(([name, data]) => {
            const isFolder = data.type === "folder";
            const fullPath = data.path || (currentPath ? `${currentPath}/${name}` : name);
            const nodeClass = isFolder ? "folder" : "file";
            const childrenHtml = isFolder && data.children ? 
                `<ul class="tree-children hidden">${this.renderTree(data.children, fullPath)}</ul>` : "";
            
            html += `
                <li>
                    <span class="tree-node ${nodeClass}" data-path="${fullPath}" data-name="${name}">
                        ${name}
                    </span>
                    ${childrenHtml}
                </li>`;
        });
        return html;
    },

    addTreeEvents() {
        const { treeRoot } = this.elements;
        
        // Toggle folders
        treeRoot.querySelectorAll(".tree-node.folder").forEach((node) => {
            node.onclick = (e) => {
                e.stopPropagation();
                const childrenUl = node.parentElement.querySelector(".tree-children");
                if (childrenUl) {
                    childrenUl.classList.toggle("hidden");
                    node.classList.toggle("expanded");
                }
            };
        });

        // Click files
        treeRoot.querySelectorAll(".tree-node.file").forEach((node) => {
            node.onclick = async (e) => {
                const filePath = e.target.dataset.path;
                if (!filePath) return;

                treeRoot.querySelectorAll(".tree-node").forEach((n) => n.classList.remove("selected"));
                e.target.classList.add("selected");

                await this.loadFileContent(filePath);
            };
        });
    },

    async loadFileContent(fileName) {
        const { fileEditor, currentFileSpan } = this.elements;
        try {
            let content;
            if (this.editorContent[fileName]) {
                content = this.editorContent[fileName];
            } else {
                content = await window.ipcAPI.invoke("read-zip-file", fileName);
                this.editorContent[fileName] = content;
            }

            fileEditor.value = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
            this.currentSelectedFile = fileName;
            if (currentFileSpan) currentFileSpan.textContent = fileName;
        } catch (err) {
            showNotification("Error loading file: " + err.message, "error");
            fileEditor.value = "// Error loading file";
        }
    },

    async saveCurrentFile() {
        if (!this.currentSelectedFile) {
            showNotification("No file selected", "warning");
            return;
        }
        const { fileEditor } = this.elements;
        try {
            const parsedContent = JSON.parse(fileEditor.value);
            const formattedContent = JSON.stringify(parsedContent, null, 2);
            
            await window.ipcAPI.invoke("write-zip-file", { 
                fileName: this.currentSelectedFile, 
                content: formattedContent 
            });

            this.editorContent[this.currentSelectedFile] = parsedContent;
            fileEditor.value = formattedContent;
            showNotification("File saved successfully!", "success");

            // Bắn event để các module khác (như HTTP) biết để cập nhật
            document.dispatchEvent(new CustomEvent("workspace-data-updated", {
                detail: { file: this.currentSelectedFile }
            }));
        } catch (err) {
            showNotification("Invalid JSON or error saving: " + err.message, "error");
        }
    },

    addGlobalListeners() {
        // Shortcut Ctrl + S
        document.addEventListener("keydown", (e) => {
            if (e.ctrlKey && e.key === "s") {
                const activePage = document.querySelector('.page.active');
                if (activePage && activePage.id === 'page-admin') {
                    e.preventDefault();
                    this.saveCurrentFile();
                }
            }
        });
    }
};

// Khởi chạy ngay khi file được load
AdminPage.init();