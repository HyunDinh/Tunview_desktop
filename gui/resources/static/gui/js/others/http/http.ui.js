let resizeTimer;
const newModuleBtn = document.getElementById("new-module-btn");
const moduleModal = document.getElementById("module-modal");
const moduleNameInput = document.getElementById("module-name-input");
const saveModuleBtn = document.getElementById("save-module-btn");
const cancelModuleBtn = document.getElementById("cancel-module-btn");
const contextMenu = document.getElementById("context-menu");
const groupModal = document.getElementById("group-modal");
const groupNameInput = document.getElementById("group-name-input");
const targetModuleLabel = document.getElementById("target-module-label");
const deleteModal = document.getElementById("delete-confirm-modal");
const deleteMsg = document.getElementById("delete-confirm-message");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
const caseModal = document.getElementById("case-modal");
const ctxNewCase = document.getElementById("ctx-new-case");
const ctxDeleteGroup = document.getElementById("ctx-delete-group");
const configModal = document.getElementById("config-modal");
const envListContainer = document.getElementById("env-list-container");
let rightClickedGroup = null;
let rightClickedModule = null;
let rightClickedCaseName = null;
let deleteType = null;
let currentConfig = null;

httpSplitter.addEventListener("mousedown", (e) => {
  isResizing = true;
  pageHttpBoundingRect = httpPage.getBoundingClientRect();
  document.body.style.cursor = "ns-resize";
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
});
function handleMouseMove(e) {
  if (!isResizing) return;
  const newHttpViewHeight = e.clientY - pageHttpBoundingRect.top;
  const totalHeight = pageHttpBoundingRect.height;
  const splitterHeight = httpSplitter.offsetHeight;
  const remainingHeight = totalHeight - newHttpViewHeight - splitterHeight;
  const minHttpViewHeight = 100;
  const minHttpRunHeight = 50;
  if (newHttpViewHeight >= minHttpViewHeight && remainingHeight >= minHttpRunHeight) {
    httpView.style.height = `${newHttpViewHeight}px`;
    httpRun.style.height = `${remainingHeight}px`;
  }
}
function handleMouseUp() {
  isResizing = false;
  document.body.style.cursor = "default";

  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("mouseup", handleMouseUp);
}
function initializeSplitHeights() {
  const initialTotalHeight = httpPage.offsetHeight;
  const splitterHeight = httpSplitter.offsetHeight;
  const minHeight = 50;
  const tolerance = 5;
  let newHttpViewHeight;
  let newHttpRunHeight;
  if (httpView.style.height) {
    const currentViewHeight = parseFloat(httpView.style.height);
    const currentRunHeight = parseFloat(httpRun.style.height);
    const availableSpace = initialTotalHeight - splitterHeight;
    if (currentRunHeight <= minHeight + tolerance) {
      newHttpRunHeight = minHeight;
      newHttpViewHeight = availableSpace - newHttpRunHeight;
    } else if (currentViewHeight <= minHeight + tolerance) {
      newHttpViewHeight = minHeight;
      newHttpRunHeight = availableSpace - newHttpViewHeight;
    } else {
      const currentTotal = currentViewHeight + currentRunHeight;
      const ratio = currentViewHeight / currentTotal;
      newHttpViewHeight = availableSpace * ratio;
      newHttpRunHeight = availableSpace - newHttpViewHeight;
    }
  } else {
    const defaultRunHeight = minHeight;
    newHttpRunHeight = defaultRunHeight;
    newHttpViewHeight = initialTotalHeight - splitterHeight - defaultRunHeight;
  }
  newHttpViewHeight = Math.max(newHttpViewHeight, minHeight);
  newHttpRunHeight = Math.max(newHttpRunHeight, minHeight);
  if (newHttpViewHeight + newHttpRunHeight + splitterHeight > initialTotalHeight) {
    newHttpViewHeight = initialTotalHeight - splitterHeight - newHttpRunHeight;
  }
  httpView.style.height = `${newHttpViewHeight}px`;
  httpRun.style.height = `${newHttpRunHeight}px`;
}
function handleWindowResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    initializeSplitHeights();
  }, 20);
}
newModuleBtn.addEventListener("click", () => {
  moduleNameInput.value = "";
  moduleModal.classList.remove("hidden");
  moduleNameInput.focus();
});
cancelModuleBtn.addEventListener("click", () => {
  moduleModal.classList.add("hidden");
});
saveModuleBtn.addEventListener("click", async () => {
  const newName = moduleNameInput.value.trim();

  if (!newName) {
    showNotification("Module name cannot be empty", "warning");
    return;
  }

  if (currentTestcases && currentTestcases[newName]) {
    showNotification("Module already exists", "error");
    return;
  }

  if (!currentTestcases) currentTestcases = {};
  currentTestcases[newName] = [];

  try {
    const response = await window.ipcAPI.invoke("write-zip-file", {
      fileName: window.PATHS.TVWS_HTTP_SCENARIO_TESTCASE,
      content: currentTestcases,
    });

    if (response && response.success === false) {
      throw new Error(response.error);
    }

    showNotification(`Module "${newName}" created successfully`, "success");
    moduleModal.classList.add("hidden");

    await loadHttpTree();
  } catch (err) {
    showNotification("Failed to save module: " + err.message, "error");
  }
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !moduleModal.classList.contains("hidden")) {
    moduleModal.classList.add("hidden");
  }
});
function closeContextMenu() {
  contextMenu.classList.add("hidden");
  contextMenu.style.display = "none";
}
httpTreeRoot.addEventListener("contextmenu", (e) => {
    const node = e.target.closest(".tree-node");

    if (node) {
        e.preventDefault();
        e.stopPropagation();

        rightClickedModule = node.dataset.module;
        rightClickedGroup = node.dataset.group;
        
        const isCase = node.classList.contains("file");
        const isGroup = !!rightClickedGroup && !isCase;

        contextMenu.classList.remove("hidden");
        contextMenu.style.display = "block";
        
        if (isCase) {
            rightClickedCaseName = node.dataset.path;
            rightClickedModule = node.dataset.caseModule;
            rightClickedGroup = node.dataset.caseGroup;
        }

        document.getElementById("ctx-new-group").style.display = (!isGroup && !isCase) ? "block" : "none";
        document.getElementById("ctx-delete-module").style.display = (!isGroup && !isCase) ? "block" : "none";
        document.getElementById("ctx-new-case").style.display = isGroup ? "block" : "none";
        document.getElementById("ctx-delete-group").style.display = isGroup ? "block" : "none";
        
        const deleteCaseBtn = document.getElementById("ctx-delete-case");
        if (deleteCaseBtn) {
            deleteCaseBtn.style.display = isCase ? "block" : "none";
        }

        let x = e.clientX;
        let y = e.clientY;
        if (x + contextMenu.offsetWidth > window.innerWidth) x -= contextMenu.offsetWidth;
        if (y + contextMenu.offsetHeight > window.innerHeight) y -= contextMenu.offsetHeight;
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
    }
});
window.addEventListener("mousedown", (e) => {
  if (!contextMenu.classList.contains("hidden") && !contextMenu.contains(e.target)) {
    closeContextMenu();
  }
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeContextMenu();
  }
});
window.addEventListener("click", () => {
  contextMenu.classList.add("hidden");
  contextMenu.style.display = "none";
});
document.getElementById("ctx-delete-module").addEventListener("click", () => {
  if (!rightClickedModule) return;
  deleteType = "module";
  deleteMsg.innerHTML = `Are you sure you want to delete module <strong>"${rightClickedModule}"</strong>?`;
  deleteModal.classList.remove("hidden");
});
cancelDeleteBtn.addEventListener("click", () => {
  deleteModal.classList.add("hidden");
});
confirmDeleteBtn.addEventListener("click", async () => {
    try {
        if (deleteType === "module") {
            delete currentTestcases[rightClickedModule];
            await saveAndRefreshTree(`Module "${rightClickedModule}" deleted.`);
        } else if (deleteType === "group") {
            currentTestcases[rightClickedModule] = currentTestcases[rightClickedModule].filter((g) => g.group !== rightClickedGroup);
            await saveAndRefreshTree(`Group "${rightClickedGroup}" deleted.`);
        } 
        // --- LOGIC XÓA CASE MỚI ---
        else if (deleteType === "case") {
            const groupData = findGroupData(currentTestcases, rightClickedModule, rightClickedGroup);
            if (groupData) {
                // Lọc bỏ case dựa trên ID hoặc Name (nên dùng ID để chính xác tuyệt đối)
                groupData.cases = groupData.cases.filter((c, idx) => {
                    const cName = c.name || `Case ${idx + 1}`;
                    return cName !== rightClickedCaseName;
                });

                // Nếu case đang xóa cũng chính là case đang mở bên detail, hãy xóa trắng detail
                if (currentSelectedCase && (currentSelectedCase.name === rightClickedCaseName)) {
                    httpDetailContent.innerHTML = "";
                    detailTitle.textContent = "Select a case to view details";
                    httpSaveBtn.style.display = "none";
                    currentSelectedCase = null;
                }

                await saveAndRefreshTree(`Case "${rightClickedCaseName}" deleted.`);
            }
        }
        
        deleteModal.classList.add("hidden");
        deleteType = null;
        rightClickedCaseName = null;
    } catch (err) {
        showNotification("Delete failed: " + err.message, "error");
    }
});
window.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal")) {
    e.target.classList.add("hidden");
  }
});
document.getElementById("ctx-new-group").addEventListener("click", () => {
  if (!rightClickedModule) return;

  targetModuleLabel.textContent = `Adding to: ${rightClickedModule}`;
  groupNameInput.value = "";
  groupModal.classList.remove("hidden");
  groupNameInput.focus();
});
document.getElementById("cancel-group-btn").addEventListener("click", () => {
  groupModal.classList.add("hidden");
});
document.getElementById("save-group-btn").addEventListener("click", async () => {
  const groupName = groupNameInput.value.trim();

  if (!groupName) {
    showNotification("Group name is required", "warning");
    return;
  }

  const existingGroups = currentTestcases[rightClickedModule] || [];
  if (existingGroups.some((g) => g.group === groupName)) {
    showNotification("Group name already exists in this module", "error");
    return;
  }

  currentTestcases[rightClickedModule].push({
    group: groupName,
    cases: [],
  });

  await saveAndRefreshTree(`Group "${groupName}" added to "${rightClickedModule}".`);
  groupModal.classList.add("hidden");
});
async function saveAndRefreshTree(successMsg) {
  try {
    const result = await window.ipcAPI.invoke("write-zip-file", {
      fileName: window.PATHS.TVWS_HTTP_SCENARIO_TESTCASE,
      content: currentTestcases,
    });

    if (result && result.success === false) throw new Error(result.error);

    showNotification(successMsg, "success");
    await loadHttpTree();
  } catch (err) {
    showNotification("Error: " + err.message, "error");
  }
}
ctxNewCase.addEventListener("click", (e) => {
  e.stopPropagation(); // Rất quan trọng để không bị window.click ẩn mất dữ liệu

  if (rightClickedModule && rightClickedGroup) {
    // Gán trực tiếp vào dataset của Modal
    caseModal.dataset.currentModule = rightClickedModule;
    caseModal.dataset.currentGroup = rightClickedGroup;

    // Hiển thị nhãn trên modal cho người dùng thấy
    const modLabel = document.getElementById("target-module-label");
    const grpLabel = document.getElementById("target-group-label");
    if (modLabel) modLabel.textContent = rightClickedModule;
    if (grpLabel) grpLabel.textContent = rightClickedGroup;

    resetCaseForm();
    caseModal.classList.remove("hidden");

    // Đóng menu sau khi đã xử lý xong
    closeContextMenu();
  } else {
    showNotification("Lỗi: Không xác định được Module/Group mục tiêu từ cây thư mục.", "error");
  }
});
document.getElementById("case-method").addEventListener("change", (e) => {
  const method = e.target.value;
  const bodySec = document.getElementById("body-section");
  ["POST", "PUT", "PATCH"].includes(method) ? bodySec.classList.remove("hidden") : bodySec.classList.add("hidden");
});
document.getElementById("add-validation-btn").addEventListener("click", () => {
  const tbody = document.querySelector("#validation-table tbody");
  const row = document.createElement("tr");
  row.innerHTML = `
        <td><input type="text" class="no-margin-bottom v-field" placeholder="e.g. status"></td>
        <td><input type="text" class="no-margin-bottom v-data" placeholder="e.g. success"></td>
        <td><button type="button" class="delete-row-btn">x</button></td>
    `;
  const inputs = row.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === '|') {
        e.preventDefault();
      }
    });
    input.addEventListener('input', (e) => {
      if (e.target.value.includes('|')) {
        e.target.value = e.target.value.replace(/\|/g, '');
      }
    });
  });
  row.querySelector('.delete-row-btn').addEventListener('click', () => row.remove());
  tbody.appendChild(row);
});
document.getElementById("save-case-btn").addEventListener("click", async () => {
  const targetModule = caseModal.dataset.currentModule;
  const targetGroup = caseModal.dataset.currentGroup;
  if (!targetModule || !targetGroup) {
    showNotification("Error: Target Module or Group missing.", "error");
    return;
  }
  const name = document.getElementById("case-name").value.trim();
  const testId = document.getElementById("case-test-id").value.trim();
  const method = document.getElementById("case-method").value;
  const api = document.getElementById("case-api").value.trim();
  const expectedCode = document.getElementById("case-code").value.trim();
  if (!testId || !api || !expectedCode) {
    showNotification("Please fill all required fields", "warning");
    return;
  }
  const validationRows = document.querySelectorAll("#validation-table tbody tr");
  let fieldsArray = [];
  let dataArray = [];
  let hasSpaceError = false;
  validationRows.forEach((row) => {
    const fieldVal = row.querySelector(".v-field").value.trim();
    const dataVal = row.querySelector(".v-data").value.trim();

    if (fieldVal) {
      if (/\s/.test(fieldVal)) {
        hasSpaceError = true;
      }
      fieldsArray.push(fieldVal);
      dataArray.push(dataVal || "");
    }
  });
  if (hasSpaceError) {
    showNotification("Custom Expected Field must not contain spaces!", "error");
    return;
  }
  const newCase = {
    test_id: isNaN(testId) ? testId : parseInt(testId),
    name: name || testId,
    method: method,
    api: api,
    auth_token: document.getElementById("case-auth").value,
    expected_code: expectedCode,
    expected_response_time: document.getElementById("case-response-time").value.trim() || undefined
  };
  if (fieldsArray.length > 0) {
    newCase.custom_expected_field = fieldsArray.join("|");
    newCase.custom_expected_data = dataArray.join("|");
  }
  if (["POST", "PUT", "PATCH"].includes(method)) {
    const bodyVal = document.getElementById("case-body").value.trim();
    try {
      newCase.body = bodyVal ? JSON.parse(bodyVal) : {};
    } catch (e) {
      showNotification("Invalid JSON in Request Body", "error");
      return;
    }
  }
  try {
    const moduleData = currentTestcases[targetModule];
    const groupData = moduleData.find((g) => g.group === targetGroup);

    if (groupData.cases.some((c) => String(c.test_id) === String(testId))) {
      showNotification(`Test ID ${testId} already exists!`, "error");
      return;
    }
    groupData.cases.push(newCase);
    await saveAndRefreshTree(`Case ${testId} created successfully.`);
    caseModal.classList.add("hidden");
  } catch (err) {
    showNotification("Save failed: " + err.message, "error");
  }
});
function resetCaseForm() {
  document.getElementById("case-name").value = "";
  document.getElementById("case-test-id").value = "";
  document.getElementById("case-api").value = "";
  document.getElementById("case-body").value = "";
  document.getElementById("case-response-time").value = "";
  document.querySelector("#validation-table tbody").innerHTML = "";
}
ctxDeleteGroup.addEventListener("click", () => {
  if (!rightClickedGroup) return;
  deleteType = "group";
  deleteMsg.innerHTML = `Are you sure you want to delete group <strong>"${rightClickedGroup}"</strong>?`;
  deleteModal.classList.remove("hidden");
});
document.getElementById("cancel-case-btn").addEventListener("click", () => {
  caseModal.classList.add("hidden");
});
document.getElementById("ctx-delete-case").addEventListener("click", () => {
    if (!rightClickedCaseName) return;
    deleteType = "case";
    deleteMsg.innerHTML = `Are you sure you want to delete case <strong>"${rightClickedCaseName}"</strong>?`;
    deleteModal.classList.remove("hidden");
    closeContextMenu();
});
document.getElementById("edit-config-btn").addEventListener("click", async () => {
    try {
        // Gọi IPC để lấy file config.json từ zip
        currentConfig = await window.ipcAPI.invoke("read-zip-file", {
            fileName: window.PATHS.TVWS_HTTP_SCENARIO_CONFIG
        });

        // Điền dữ liệu Global
        document.getElementById("cfg-max-retries").value = currentConfig.max_retries || 0;
        document.getElementById("cfg-connect-timeout").value = currentConfig.connect_timeout || 0;
        document.getElementById("cfg-read-timeout").value = currentConfig.read_timeout || 0;

        // Render Environments
        renderEnvList(currentConfig.envs || []);

        configModal.classList.remove("hidden");
    } catch (err) {
        showNotification("Failed to load config: " + err.message, "error");
    }
});
function renderEnvList(envs) {
    envListContainer.innerHTML = "";
    
    envs.forEach((env, index) => {
        const row = document.createElement("div");
        // Gán class active-env ngay từ đầu nếu dữ liệu là active
        row.className = `env-item ${env.active ? 'active-env' : ''}`;
        
        row.innerHTML = `
            <input type="radio" name="active-env" class="radio-active" 
                ${env.active ? 'checked' : ''} 
                data-index="${index}">
            <input type="text" class="env-name no-margin-bottom" 
                placeholder="Environment Name (e.g. Dev, Staging)" 
                value="${env.name || ''}">
            <input type="text" class="env-url no-margin-bottom" 
                placeholder="Base URL (e.g. https://api.dev.com)" 
                value="${env.url || ''}">
            <button class="btn-delete-env" title="Delete Environment">&times;</button>
        `;

        // Sự kiện xóa dòng
        row.querySelector(".btn-delete-env").onclick = () => {
            const isWasActive = row.querySelector(".radio-active").checked;
            row.remove();
            
            // Nếu xóa đúng dòng đang active, tự động chọn dòng đầu tiên còn lại (nếu có)
            if (isWasActive) {
                const firstRemainingRadio = envListContainer.querySelector(".radio-active");
                if (firstRemainingRadio) {
                    firstRemainingRadio.checked = true;
                    firstRemainingRadio.closest(".env-item").classList.add("active-env");
                }
            }
        };

        // Sự kiện đổi trạng thái Active (Radio Button)
        const radio = row.querySelector(".radio-active");
        radio.onchange = () => {
            // Xóa class highlight của tất cả các hàng khác
            document.querySelectorAll(".env-item").forEach(el => {
                el.classList.remove("active-env");
            });
            
            // Thêm highlight cho hàng hiện tại
            if (radio.checked) {
                row.classList.add("active-env");
            }
        };

        envListContainer.appendChild(row);
    });
}
document.getElementById("add-env-btn").onclick = () => {
    const newEnv = { name: "new_env", url: "http://", active: false };
    const currentEnvs = Array.from(envListContainer.querySelectorAll(".env-item")).length;
    if (currentEnvs === 0) newEnv.active = true; // Cái đầu tiên tự active
    
    // Tận dụng hàm renderEnvList nhưng append thêm
    const tempDiv = document.createElement("div");
    renderEnvList([{...newEnv}]); 
    const newNode = envListContainer.firstChild;
    envListContainer.appendChild(newNode);
};
document.getElementById("save-config-btn").onclick = async () => {
    const updatedConfig = {
        max_retries: parseInt(document.getElementById("cfg-max-retries").value),
        connect_timeout: parseInt(document.getElementById("cfg-connect-timeout").value),
        read_timeout: parseInt(document.getElementById("cfg-read-timeout").value),
        envs: []
    };

    const envRows = envListContainer.querySelectorAll(".env-item");
    envRows.forEach(row => {
        updatedConfig.envs.push({
            name: row.querySelector(".env-name").value.trim(),
            url: row.querySelector(".env-url").value.trim(),
            active: row.querySelector(".radio-active").checked
        });
    });

    try {
        await window.ipcAPI.invoke("write-zip-file", {
            fileName: window.PATHS.TVWS_HTTP_SCENARIO_CONFIG,
            content: updatedConfig
        });
        showNotification("Configuration saved successfully", "success");
        configModal.classList.add("hidden");
    } catch (err) {
        showNotification("Save failed: " + err.message, "error");
    }
};
document.getElementById("cancel-config-btn").onclick = () => configModal.classList.add("hidden");