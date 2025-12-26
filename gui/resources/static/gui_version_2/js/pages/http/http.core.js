const httpPage = document.getElementById('page-http');
const httpTreeRoot = document.getElementById('http-tree-root');
const detailTitle = document.getElementById('detail-title');
const httpDetailContent = document.getElementById('http-detail-content');
const httpSaveBtn = document.getElementById('http-save-btn');
const selectedCountEl = document.getElementById('selected-count');
const runBtn = document.getElementById('run-btn');
const stopBtn = document.getElementById('stop-btn');
const terminalOutput = document.getElementById('terminal-output');
const httpSplitter = document.getElementById('http-splitter');
const httpView = httpPage.querySelector('.http-view');
const httpRun = httpPage.querySelector('.http-run');
const selectAllBtn = document.getElementById('select-all-btn');

window.HttpPageTreeView = {
  currentTestcases: null,
  allTreeCheckboxes: [],
  expandedNodes: new Set(),

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const selectAllBtn = document.getElementById('select-all-btn');
    if (selectAllBtn) {
      selectAllBtn.onclick = () => this.toggleSelectAll();
    }
  },

  async loadHttpTree() {
    try {
      const workspaceInfo = await window.ipcAPI.invoke('get-workspace-info');
      if (!workspaceInfo || !workspaceInfo.success) {
        if (typeof showNotification === 'function')
          showNotification('Please open a workspace first.', 'warning');
        return;
      }

      this.currentTestcases = await window.ipcAPI.invoke(
        'read-zip-file',
        window.PATHS.TVWS_HTTP_SCENARIO_TESTCASE
      );

      if (!this.currentTestcases || Object.keys(this.currentTestcases).length === 0) {
        httpTreeRoot.innerHTML = "<li><span class='tree-node'>No testcases found</span></li>";
        this.updateSelectedCount();
        return;
      }

      const treeStructure = this.buildStructure(this.currentTestcases);
      httpTreeRoot.innerHTML = this.renderHtml(treeStructure, 'module');
      this.allTreeCheckboxes = httpTreeRoot.querySelectorAll('.tree-checkbox');
      this.attachNodeEvents();
      this.updateSelectedCount();
      if (window.HttpPageRunner) window.HttpPageRunner.resetTerminal();
    } catch (err) {
      console.error(err);
      httpTreeRoot.innerHTML = "<li><span class='tree-node'>Error loading testcases</span></li>";
    }
  },

  buildStructure(testcases) {
    const root = {};
    Object.entries(testcases).forEach(([moduleName, groups]) => {
      const moduleNode = { type: 'folder', name: moduleName, children: {} };
      groups.forEach(groupObj => {
        const groupName = groupObj.group;
        const groupNode = {
          type: 'folder',
          name: groupName,
          data: groupObj,
          module: moduleName,
          children: {},
        };
        groupObj.cases.forEach((caseObj, idx) => {
          const caseName = caseObj.name || `Case ${idx + 1}`;
          groupNode.children[caseName] = {
            type: 'file',
            data: caseObj,
            module: moduleName,
            group: groupName,
          };
        });
        moduleNode.children[groupName] = groupNode;
      });
      root[moduleName] = moduleNode;
    });
    return root;
  },

  renderHtml(node, level = 'module') {
    let html = '';
    Object.entries(node).forEach(([name, data]) => {
      const isFolder = data.type === 'folder';
      const nodeClass = isFolder ? 'folder' : 'file';
      const icon = level === 'module' ? '🏛️ ' : isFolder ? '📁 ' : '📄 ';

      // 3. KIỂM TRA TRẠNG THÁI MỞ TỪ Set expandedNodes
      const key = level === 'module' ? `mod:${name}` : `grp:${data.module}/${name}`;
      const isExpanded = this.expandedNodes.has(key);

      // Nếu folder đang mở thì bỏ class hidden của ul con và thêm class expanded cho span
      const expandedClass = isExpanded ? 'expanded' : '';
      const hiddenClass = isExpanded ? '' : 'hidden';

      const childrenHtml =
        isFolder && data.children
          ? `<ul class="tree-children ${hiddenClass}">${this.renderHtml(
              data.children,
              level === 'module' ? 'group' : 'case'
            )}</ul>`
          : '';

      const checkboxHtml = `<input type="checkbox" class="tree-checkbox" />`;
      let dragAttr = `draggable="true" class="draggable-${level}"`;

      html += `
        <li ${dragAttr}>
          <span class="tree-node ${nodeClass} ${expandedClass}" 
                data-type="${level}" 
                data-name="${name}"
                data-id="${data.data?.test_id || ''}"
                data-module-name="${level === 'module' ? name : data.module || ''}" 
                data-group-name="${level === 'group' ? name : data.group || ''}">
            ${checkboxHtml}${icon}${name}
          </span>
          ${childrenHtml}
        </li>`;
    });
    return html;
  },

  attachNodeEvents() {
    const allNodes = httpTreeRoot.querySelectorAll('.tree-node');

    allNodes.forEach(node => {
      node.onclick = e => {
        e.stopPropagation();
        allNodes.forEach(n => n.classList.remove('selected'));
        node.classList.add('selected');

        const { type, name, moduleName, groupName } = node.dataset;

        // 1. Xử lý đóng/mở Folder
        if (node.classList.contains('folder')) {
          const childrenUl = node.parentElement.querySelector(':scope > .tree-children');
          if (childrenUl) {
            const isOpening = childrenUl.classList.contains('hidden');
            childrenUl.classList.toggle('hidden');
            node.classList.toggle('expanded');
            const key = type === 'module' ? `mod:${name}` : `grp:${moduleName}/${name}`;
            if (isOpening) this.expandedNodes.add(key);
            else this.expandedNodes.delete(key);
          }
        }

        // 2. Hiển thị nội dung (Table hoặc Detail)
        if (type === 'group' && window.HttpPageDetail) {
          const groupData = this.findGroupData(this.currentTestcases, moduleName, name);
          if (groupData) window.HttpPageDetail.renderCasesTable(groupData.cases, name);
        } else if (type === 'case' && window.HttpPageDetail) {
          const groupData = this.findGroupData(this.currentTestcases, moduleName, groupName);
          const caseData = groupData?.cases.find(
            (c, idx) => (c.name || `Case ${idx + 1}`) === name
          );
          if (caseData)
            window.HttpPageDetail.renderCaseDetail(caseData, name, moduleName, groupName);
        }
      };
    });

    // Checkbox events
    httpTreeRoot.querySelectorAll('.tree-checkbox').forEach(cb => {
      cb.onclick = e => e.stopPropagation();
      cb.onchange = e => {
        const parentLi = e.target.closest('li');
        this.toggleChildrenCheckboxes(parentLi, e.target.checked);
      };
    });

    this.attachDragEvents();
  },

  attachDragEvents() {
    const draggables = httpTreeRoot.querySelectorAll(
      '.draggable-module, .draggable-group, .draggable-case'
    );
    const placeholder = document.createElement('li');
    placeholder.className = 'drag-placeholder';

    draggables.forEach(li => {
      const node = li.querySelector('.tree-node');
      if (!node) return;

      li.addEventListener('dragstart', e => {
        e.stopPropagation();
        this.draggingNode = li;
        this.draggingNodeType = node.dataset.type;
        li.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try {
          e.dataTransfer.setData('text/plain', this.draggingNodeType);
        } catch (ex) {}
      });

      li.addEventListener('dragend', e => {
        e.stopPropagation();
        li.classList.remove('dragging');
        this.draggingNode = null;
        if (placeholder.parentNode) {
          placeholder.parentNode.removeChild(placeholder);
        }
      });

      li.addEventListener('dragover', e => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.draggingNode || this.draggingNode === li) return;

        const targetNode = li.querySelector('.tree-node');
        const targetType = targetNode.dataset.type;
        const isFolder = targetNode.classList.contains('folder');
        const rect = li.getBoundingClientRect();

        let canDrop = false;

        // --- Dragging a Module ---
        if (this.draggingNodeType === 'module' && targetType === 'module') {
          canDrop = true;
          const next = (e.clientY - rect.top) / rect.height > 0.5;
          li.parentNode.insertBefore(placeholder, next ? li.nextSibling : li);
        }

        // --- Dragging a Group ---
        else if (this.draggingNodeType === 'group') {
          if (targetType === 'group') {
            // Reorder with other groups
            canDrop = true;
            const next = (e.clientY - rect.top) / rect.height > 0.5;
            li.parentNode.insertBefore(placeholder, next ? li.nextSibling : li);
          } else if (targetType === 'module' && isFolder) {
            // Drop into a module
            canDrop = true;
            const childrenUl = li.querySelector('.tree-children');
            if (childrenUl && !childrenUl.contains(this.draggingNode)) {
              // prevent dropping into self
              childrenUl.appendChild(placeholder);
            }
          }
        }

        // --- Dragging a Case ---
        else if (this.draggingNodeType === 'case') {
          if (targetType === 'case') {
            // Reorder with other cases
            canDrop = true;
            const next = (e.clientY - rect.top) / rect.height > 0.5;
            li.parentNode.insertBefore(placeholder, next ? li.nextSibling : li);
          } else if (targetType === 'group' && isFolder) {
            // Drop into a group
            canDrop = true;
            const childrenUl = li.querySelector('.tree-children');
            if (childrenUl && !childrenUl.contains(this.draggingNode)) {
              childrenUl.appendChild(placeholder);
            }
          }
        }

        if (canDrop) {
          e.dataTransfer.dropEffect = 'move';
        } else {
          e.dataTransfer.dropEffect = 'none';
        }
      });

      li.addEventListener('drop', async e => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.draggingNode) return;

        if (placeholder.parentNode) {
          placeholder.parentNode.insertBefore(this.draggingNode, placeholder);
          await this.syncTreeOrder();
        }
        if (placeholder.parentNode) {
          placeholder.parentNode.removeChild(placeholder);
        }
      });
    });
  },

  async syncTreeOrder() {
    const newTestcases = {};
    const moduleLis = httpTreeRoot.querySelectorAll('li.draggable-module');

    // 1. Tạo Map truy xuất dữ liệu Case dựa trên test_id (Không phụ thuộc vào tên Group)
    const allCasesMap = new Map();
    Object.values(this.currentTestcases).forEach(groups => {
      groups.forEach(group => {
        group.cases.forEach(c => {
          // Lưu dữ liệu gốc vào map dùng test_id làm chìa khóa
          allCasesMap.set(String(c.test_id), c);
        });
      });
    });

    // 2. Duyệt cấu trúc DOM mới
    moduleLis.forEach(moduleLi => {
      const moduleNode = moduleLi.querySelector(':scope > .tree-node');
      const moduleName = moduleNode.dataset.moduleName;

      if (!newTestcases[moduleName]) newTestcases[moduleName] = [];

      const groupLis = moduleLi.querySelectorAll(':scope > .tree-children > li.draggable-group');
      groupLis.forEach(groupLi => {
        const groupNode = groupLi.querySelector(':scope > .tree-node');
        const groupName = groupNode.dataset.groupName;

        // Lấy lại Group gốc từ dữ liệu cũ (để giữ isLocked, description...)
        // Tìm Group theo tên trong toàn bộ dữ liệu cũ
        let originalGroup = null;
        for (const mod in this.currentTestcases) {
          const found = this.currentTestcases[mod].find(g => g.group === groupName);
          if (found) {
            originalGroup = found;
            break;
          }
        }

        if (!originalGroup) {
          // Trường hợp Group mới tạo chưa có trong data cũ
          originalGroup = { group: groupName, cases: [] };
        }

        const newGroup = { ...originalGroup, cases: [] };
        newTestcases[moduleName].push(newGroup);

        // Duyệt các Case bên trong Group này từ DOM
        const caseLis = groupLi.querySelectorAll(':scope > .tree-children > li.draggable-case');
        caseLis.forEach(caseLi => {
          const caseNode = caseLi.querySelector(':scope > .tree-node');

          // QUAN TRỌNG: Bạn cần đảm bảo lúc renderHtml, mỗi Case node phải có data-id="${caseObj.test_id}"
          const caseId = caseNode.dataset.id;

          const originalCaseData = allCasesMap.get(String(caseId));
          if (originalCaseData) {
            newGroup.cases.push(originalCaseData);
          }
        });
      });
    });

    // 3. Cập nhật và lưu
    this.currentTestcases = newTestcases;
    if (window.HttpPageUI && typeof window.HttpPageUI.saveAndRefreshTree === 'function') {
      await window.HttpPageUI.saveAndRefreshTree('Tree order updated', newTestcases);
    }
  },

  toggleChildrenCheckboxes(parentLi, checked) {
    // Chỉ tìm checkbox ở các cấp con TRỰC TIẾP và SÂU HƠN của li này
    const childCheckboxes = parentLi.querySelectorAll('.tree-children .tree-checkbox');
    childCheckboxes.forEach(cb => {
      cb.checked = checked;
    });
    this.updateSelectedCount();
  },

  updateSelectedCount() {
    const count = this.getSelectedCount();
    selectedCountEl.textContent = `Selected: ${count} testcases`;
    runBtn.disabled = count === 0;
  },

  getSelectedCount() {
    return httpTreeRoot.querySelectorAll('.tree-node.file .tree-checkbox:checked').length;
  },

  toggleSelectAll() {
    const allFileCheckboxes = httpTreeRoot.querySelectorAll('.tree-node.file .tree-checkbox');
    const currentSelected = this.getSelectedCount();
    const total = allFileCheckboxes.length;
    const shouldSelect = currentSelected < total;

    this.allTreeCheckboxes.forEach(cb => (cb.checked = shouldSelect));
    selectAllBtn.textContent = shouldSelect ? 'Deselect All' : 'Select All';
    this.updateSelectedCount();
  },

  findGroupData(testcases, moduleName, groupName) {
    const groups = testcases[moduleName] || [];
    return groups.find(g => g.group === groupName);
  },

  saveExpansionState() {
    this.expandedNodes.clear();
    const expandedElements = httpTreeRoot.querySelectorAll('.tree-node.expanded');
    expandedElements.forEach(node => {
      const type = node.dataset.type;
      const name = node.dataset.name;
      const moduleName = node.dataset.moduleName;
      // Tạo key duy nhất để không bị trùng tên group giữa các module
      const key = type === 'module' ? `mod:${name}` : `grp:${moduleName}/${name}`;
      this.expandedNodes.add(key);
    });
  },
};
window.HttpPageDetail = {
  currentSelectedCase: null,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const httpSaveBtn = document.getElementById('http-save-btn');
    httpSaveBtn.onclick = () => this.handleSave();
  },

  trimFirstLineLeading(text) {
    if (typeof text !== 'string') return text;
    if (!text.includes('\n')) return text.trimStart();
    const lines = text.split('\n');
    if (lines.length > 0) lines[0] = lines[0].trimStart();
    return lines.join('\n');
  },

  renderCasesTable(cases, groupName) {
    this.currentSelectedCase = null;
    httpSaveBtn.style.display = 'none';
    detailTitle.textContent = `Cases in "${groupName}" (${cases.length})`;

    if (!cases || cases.length === 0) {
      httpDetailContent.innerHTML = '<p>No cases in this group.</p>';
      return;
    }

    let tableHtml = `
      <table class="cases-table">
        <thead>
          <tr>
            <th>Name</th><th>Method</th><th>API</th><th>Body (Preview)</th>
            <th>Code</th><th>Auth</th><th>Time</th><th>Full</th>
          </tr>
        </thead>
        <tbody>`;
    cases.forEach((c, idx) => {
      let bodyPreview = '{}';
      if (c.body) {
        const str = JSON.stringify(c.body, null, 2);
        bodyPreview =
          this.trimFirstLineLeading(str).substring(0, 100) + (str.length > 100 ? '...' : '');
      }
      tableHtml += `
        <tr>
          <td>${c.name || `Case ${idx + 1}`}</td>
          <td>${c.method || 'GET'}</td>
          <td>${c.api || ''}</td>
          <td><pre style="font-size: 11px; margin: 0;">${bodyPreview}</pre></td>
          <td>${c.expected_code || ''}</td>
          <td>${c.auth_token || ''}</td>
          <td>${c.expected_response_time || 'N/A'}</td>
          <td>${c.display_full_response || 'FALSE'}</td>
        </tr>`;
    });
    tableHtml += `</tbody></table>`;
    httpDetailContent.innerHTML = tableHtml;
  },

  renderCaseDetail(caseData, caseName, moduleName, groupName) {
    // 1. Lưu context để hàm handleSave có thể dùng
    this.currentSelectedCase = caseData;
    this.currentContext = { moduleName, groupName, oldName: caseName };

    // 2. Hiển thị tiêu đề và nút Save
    detailTitle.textContent = caseName;
    if (httpSaveBtn) httpSaveBtn.style.display = 'block';

    // 3. Xử lý dữ liệu Validation
    const fields = caseData.custom_expected_field ? caseData.custom_expected_field.split('|') : [];
    const datas = caseData.custom_expected_data ? caseData.custom_expected_data.split('|') : [];

    // 4. Tạo HTML (Giữ nguyên cấu trúc của bạn)
    let html = `
    <div class="edit-case-form">
      <div style="display: flex; gap: 10px;">
        <div class="case-field" style="flex: 1;">
          <label>Test ID (Unique):</label>
          <input type="text" id="edit-id" value="${caseData.test_id || ''}" 
                 style="background-color: #1a1a1a; color: #ff9800; font-weight: bold;" 
                 placeholder="e.g. TC_001">
        </div>
        <div class="case-field" style="flex: 2;">
          <label>Case Name:</label>
          <input type="text" id="edit-name" value="${caseData.name || caseName}">
        </div>
      </div>

      <div style="display: flex; gap: 10px;">
        <div class="case-field" style="flex: 3;">
          <label>API Path:</label>
          <input type="text" id="edit-api" value="${caseData.api || ''}">
        </div>
        <div class="case-field" style="flex: 1;">
          <label>Method:</label>
          <select id="edit-method">
            ${['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
              .map(
                m => `<option value="${m}" ${caseData.method === m ? 'selected' : ''}>${m}</option>`
              )
              .join('')}
          </select>
        </div>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 10px;">
          <div class="case-field" style="flex: 1;">
        <label>Expected Resp Time (s):</label>
          <input type="number" id="edit-response-time" value="${
            caseData.expected_response_time || ''
          }" placeholder="e.g. 5">
        </div>
        <div class="case-field" style="flex: 2;">
          <label>Expected Resp Message:</label>
          <input type="text" id="edit-response-message" value="${
            caseData.expected_response_message || ''
          }" placeholder="e.g. Success">
        </div>
      </div>

      <div style="display: flex; gap: 10px;">
         <div class="case-field" style="flex: 1;">
          <label>Expected Code:</label>
          <input type="text" id="edit-code" value="${caseData.expected_code || '200'}">
        </div>
        <div class="case-field" style="flex: 1;">
          <label>Auth Type:</label>
          <select id="edit-auth">
            <option value="NONE" ${caseData.auth_token === 'NONE' ? 'selected' : ''}>NONE</option>
            <option value="GET" ${caseData.auth_token === 'GET' ? 'selected' : ''}>GET</option>
            <option value="SET" ${caseData.auth_token === 'SET' ? 'selected' : ''}>SET</option>
          </select>
        </div>
      </div>
      
      <h4 class="section-title">Custom Validations (No "|" allowed)</h4>
      <table id="validation-table-edit" class="cases-table">
        <thead>
          <tr>
            <th style="width: 40%">Field (No Space)</th>
            <th style="width: 50%">Expected Data</th>
            <th style="width: 10%"></th>
          </tr>
        </thead>
        <tbody>
          ${fields
            .map(
              (f, i) => `
            <tr>
              <td><input type="text" class="v-field-edit" value="${f}" placeholder="status"></td>
              <td><input type="text" class="v-data-edit" value="${
                datas[i] || ''
              }" placeholder="success"></td>
              <td><button class="delete-row-btn" onclick="this.closest('tr').remove()">×</button></td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
      <button type="button" id="add-val-row-edit" class="btn-secondary">+ Add Validation Row</button>
      
      <div class="case-field" style="margin-top:10px">
        <label>Request Body (JSON):</label>
        <textarea id="edit-body" rows="6">${JSON.stringify(caseData.body || {}, null, 2)}</textarea>
      </div>
    </div>
  `;

    // 5. Inject vào DOM
    httpDetailContent.innerHTML = html;

    // 6. Gán sự kiện nút Add Row (Sử dụng hàm của Object để chặn dấu "|")
    document.getElementById('add-val-row-edit').onclick = () => {
      const tbody = document.querySelector('#validation-table-edit tbody');
      const row = document.createElement('tr');
      row.innerHTML = `
      <td><input type="text" class="v-field-edit" placeholder="field_name"></td>
      <td><input type="text" class="v-data-edit" placeholder="value"></td>
      <td><button class="delete-row-btn" onclick="this.closest('tr').remove()">×</button></td>
    `;
      tbody.appendChild(row);
      this.attachNoPipeEvent(row); // Chặn "|" cho dòng mới
    };

    // 7. Chặn "|" cho các dòng hiện có
    document.querySelectorAll('.v-field-edit, .v-data-edit').forEach(input => {
      this.attachValidationInputEvents(input);
    });
  },

  attachValidationInputEvents(inputEl) {
    inputEl.onkeypress = e => {
      if (e.key === '|') e.preventDefault();
    };
    inputEl.oninput = e => {
      e.target.value = e.target.value.replace(/\|/g, '');
    };
  },

  attachNoPipeEvent(row) {
    row.querySelectorAll('input').forEach(input => this.attachValidationInputEvents(input));
  },

  async handleSave() {
    if (!this.currentSelectedCase || !this.currentContext) {
      return showNotification('No case selected to save!', 'warning');
    }

    const { moduleName, groupName, oldName } = this.currentContext;
    const newIdInput = document.getElementById('edit-id').value.trim();
    const newName = document.getElementById('edit-name').value.trim();

    // Chuyển ID sang số nếu có thể để đồng bộ kiểu dữ liệu
    const newId = isNaN(newIdInput) || newIdInput === '' ? newIdInput : parseInt(newIdInput);

    if (!newId) return showNotification('Test ID cannot be empty!', 'error');
    if (!newName) return showNotification('Case Name cannot be empty!', 'error');

    // 1. Kiểm tra trùng Test ID trong toàn bộ hệ thống (trừ chính nó)
    let isDuplicate = false;
    const testcases = window.HttpPageTreeView.currentTestcases;
    for (const mod in testcases) {
      for (const grp of testcases[mod]) {
        for (const c of grp.cases) {
          if (
            String(c.test_id) === String(newId) &&
            (mod !== moduleName || grp.group !== groupName || (c.name || '') !== oldName)
          ) {
            isDuplicate = true;
            break;
          }
        }
        if (isDuplicate) break;
      }
      if (isDuplicate) break;
    }

    if (isDuplicate) return showNotification('Duplicate Test ID found in another case!', 'error');

    // 2. Thu thập dữ liệu từ bảng Custom Validations
    let fieldsArray = [],
      dataArray = [],
      hasSpace = false;
    document.querySelectorAll('#validation-table-edit tbody tr').forEach(row => {
      const f = row.querySelector('.v-field-edit').value.trim();
      const d = row.querySelector('.v-data-edit').value.trim();
      if (f) {
        if (/\s/.test(f)) hasSpace = true;
        fieldsArray.push(f);
        dataArray.push(d);
      }
    });

    if (hasSpace) return showNotification('Validation fields cannot contain spaces!', 'error');

    try {
      // 3. Cập nhật dữ liệu vào Object hiện tại
      const bodyText = document.getElementById('edit-body').value;

      this.currentSelectedCase.test_id = newId;
      this.currentSelectedCase.name = newName;
      this.currentSelectedCase.api = document.getElementById('edit-api').value.trim();
      this.currentSelectedCase.method = document.getElementById('edit-method').value;
      this.currentSelectedCase.expected_code = document.getElementById('edit-code').value.trim();
      this.currentSelectedCase.auth_token = document.getElementById('edit-auth').value;
      this.currentSelectedCase.expected_response_time = document
        .getElementById('edit-response-time')
        .value.trim();
      this.currentSelectedCase.expected_response_message = document
        .getElementById('edit-response-message')
        .value.trim();
      this.currentSelectedCase.custom_expected_field = fieldsArray.join('|');
      this.currentSelectedCase.custom_expected_data = dataArray.join('|');

      try {
        this.currentSelectedCase.body = bodyText ? JSON.parse(bodyText) : {};
      } catch (e) {
        return showNotification('Invalid JSON in Request Body!', 'error');
      }

      // 4. Gọi IPC để lưu xuống file vật lý (Zip/Json)
      await window.HttpPageUI.saveAndRefreshTree('Changes saved!', testcases);

      // 5. CẬP NHẬT TRỰC TIẾP TREE VIEW TRÊN GIAO DIỆN (Để không bị lệch Dataset)
      // Tìm node dựa trên thông tin context cũ
      const selector = `.tree-node.file[data-module-name="${moduleName}"][data-group-name="${groupName}"][data-name="${oldName}"]`;
      const treeNode = document.querySelector(selector);

      if (treeNode) {
        // Cập nhật dataset name mới để lần click sau tìm đúng data
        treeNode.dataset.name = newName;

        // Cập nhật text hiển thị (Label) mà không làm hỏng Checkbox/Icon
        // Cấu trúc: [Checkbox][Icon][Text]
        const labelNodes = Array.from(treeNode.childNodes);
        const textNode = labelNodes.find(
          n => n.nodeType === Node.TEXT_NODE && n.textContent.includes(oldName)
        );

        if (textNode) {
          textNode.textContent = textNode.textContent.replace(oldName, newName);
        } else {
          // Fallback nếu không tìm thấy text node cụ thể
          const icon = treeNode.classList.contains('folder') ? '📁 ' : '📄 ';
          const checkbox = treeNode.querySelector('.tree-checkbox').outerHTML;
          treeNode.innerHTML = `${checkbox}${icon}${newName}`;
        }

        // Cập nhật lại context để nếu người dùng nhấn Save lần nữa (không tắt Detail) vẫn chạy đúng
        this.currentContext.oldName = newName;
        detailTitle.textContent = newName;

        showNotification('Success: Case updated and Tree synced.', 'success');
      } else {
        // Nếu không tìm thấy node để update (do kéo thả hoặc lỗi), refresh lại toàn bộ Tree
        window.HttpPageTreeView.loadHttpTree();
      }
    } catch (e) {
      console.error('Save error:', e);
      showNotification('Save failed: ' + e.message, 'error');
    }
  },

  navigateToCase(tid) {
    if (!tid) return;
    let foundInfo = null;
    const testcases = window.HttpPageTreeView.currentTestcases;

    // 1. Tìm thông tin trong dữ liệu gốc
    for (const [modName, groups] of Object.entries(testcases)) {
      for (const group of groups) {
        const c = group.cases.find(item => item.test_id == tid); // Dùng == để so sánh string/number
        if (c) {
          foundInfo = {
            module: modName,
            group: group.group,
            name: c.name || `Case ${group.cases.indexOf(c) + 1}`,
          };
          break;
        }
      }
      if (foundInfo) break;
    }

    if (!foundInfo) {
      return showNotification(`Test ID ${tid} not found in current scenario.`, 'warning');
    }

    // 2. Tìm Node trên DOM
    const selector = `.tree-node.file[data-module-name="${foundInfo.module}"][data-group-name="${foundInfo.group}"][data-name="${foundInfo.name}"]`;
    const targetNode = document.querySelector(selector);

    if (targetNode) {
      // 3. Mở các folder cha
      this.expandParents(targetNode);

      // 4. Highlight và Click (Click sẽ tự động render Detail nhờ attachNodeEvents)
      document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('selected'));
      targetNode.classList.add('selected');
      targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetNode.click();
    }
  },
  expandParents(node) {
    let parent = node.closest('.tree-children');
    while (parent) {
      parent.classList.remove('hidden');
      const folderNode = parent.parentElement.querySelector(':scope > .tree-node.folder');
      if (folderNode) folderNode.classList.add('expanded');
      parent = parent.parentElement.closest('.tree-children');
    }
  },
};
window.HttpPageRunner = {
  testStats: { total: 0, passed: 0, failed: 0, durations: [], groupResults: {} },
  isRunning: false,

  init() {
    this.bindEvents();
    this.listenIPC();
  },

  bindEvents() {
    const runBtn = document.getElementById('run-btn');
    const stopBtn = document.getElementById('stop-btn');
    if (runBtn) runBtn.onclick = () => this.startRun();
    if (stopBtn) stopBtn.onclick = () => this.stopRun();
  },

  listenIPC() {
    window.ipcAPI.on('http-run-update', msg => {
      switch (msg.type) {
        case 'LOG':
          let level = msg.level || 'INFO';
          let content = `[LOG] [${level}] ${msg.content}`;
          if (msg.content && msg.content.startsWith('Executing case') && level === 'INFO') {
            this.addToTerminal(msg.content, 'INFO');
          } else if (level === 'FATAL' || level === 'ERROR') {
            this.addToTerminal(content, level);
          } else {
            this.addToTerminal(content, 'default');
          }
          break;
        case 'RUN_END':
          this.renderRunEnd(msg);
          break;
        case 'RUN_COMPLETE':
          this.addToTerminal(`> ${msg.content}`, 'PROMPT');
          this.renderFinalDashboard();
          this.stopRun();
          if (typeof showNotification === 'function') {
            showNotification('HTTP Test Scenario Finished!', 'success');
          }
          break;
      }
    });
  },

  async startRun() {
    const selected = this.getSelectedTestcaseConfigs();
    if (selected.length === 0) return;

    this.testStats = {
      total: selected.length,
      passed: 0,
      failed: 0,
      durations: [],
      groupResults: {},
    };

    try {
      const globalConfig = await window.ipcAPI.invoke('get-test-config');
      if (!globalConfig) {
        this.addToTerminal(`Global config is empty. Cannot run.`, 'FATAL');
        return;
      }

      this.isRunning = true;
      const runBtn = document.getElementById('run-btn');
      const stopBtn = document.getElementById('stop-btn');
      if (runBtn) runBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = false;

      this.resetTerminal();

      const activeEnv = globalConfig.activeEnv || 'N/A';
      this.addToTerminal(
        `Starting run for ${selected.length} selected testcases... (Env: ${activeEnv})`,
        'PROMPT'
      );

      await window.ipcAPI.invoke('run-http-testcases', selected, globalConfig);
    } catch (e) {
      this.addToTerminal(`Global Run Error: ${e.message}`, 'FATAL');
      this.stopRun();
    }
  },

  stopRun() {
    window.ipcAPI.invoke('stop-http-testcases');
    this.isRunning = false;
    const runBtn = document.getElementById('run-btn');
    const stopBtn = document.getElementById('stop-btn');

    if (runBtn) {
      const count =
        typeof window.HttpPageTreeView?.getSelectedCount === 'function'
          ? window.HttpPageTreeView.getSelectedCount()
          : 0;
      runBtn.disabled = count === 0;
    }
    if (stopBtn) stopBtn.disabled = true;
    this.addToTerminal(`Run process finished or stopped.`, 'PROMPT');
  },

  getSelectedTestcaseConfigs() {
    const selected = [];
    const testcases = window.HttpPageTreeView?.currentTestcases || {};
    const httpTreeRoot = document.getElementById('http-tree-root');

    if (!httpTreeRoot) return [];
    httpTreeRoot.querySelectorAll('.tree-node.file .tree-checkbox:checked').forEach(cb => {
      const node = cb.closest('.tree-node');

      // Lấy dữ liệu từ dataset đã render trong renderHtml
      const moduleName = node.dataset.moduleName;
      const groupName = node.dataset.groupName;
      const caseName = node.dataset.name; // Trong renderHtml ta dùng data-name

      // Tìm dữ liệu gốc trong currentTestcases
      const groupData = window.HttpPageTreeView?.findGroupData(testcases, moduleName, groupName);

      // Tìm object case cụ thể trong mảng cases của group đó
      const caseData = groupData?.cases.find((c, idx) => {
        const currentName = c.name || `Case ${idx + 1}`;
        return currentName === caseName;
      });

      if (caseData) {
        selected.push({
          ...caseData,
          parentFolder: moduleName || 'General', // Gán module để backend biết đường dẫn lưu log
          groupName: groupName, // Bổ sung thông tin group nếu backend cần
        });
      }
    });
    console.log('Selected testcases to run:', selected);
    return selected;
  },

  addToTerminal(line, level = 'default') {
    const terminalOutput = document.getElementById('terminal-output');
    if (!terminalOutput) return;

    if (['PROMPT', 'default', 'INFO', 'ERROR', 'FATAL'].includes(level)) {
      const div = document.createElement('div');
      div.className = `terminal-line log-${level}`;
      if (level === 'PROMPT') {
        div.textContent = `> ${line}`;
      } else if (level === 'INFO' && line.startsWith('Executing case')) {
        div.classList.add('log-progress');
        div.textContent = line;
      } else {
        div.textContent = line;
      }
      terminalOutput.appendChild(div);
    }
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  },

  renderRunEnd(msg) {
    const terminalOutput = document.getElementById('terminal-output');
    const { caseName, status, payload, moduleName } = msg;
    const folderDisplayName = moduleName || 'General';
    const validationResults = payload?.validate_results || [];
    const rawResponseBody = payload?.httpResponse?.body;
    const failedCaseInputDetails = payload?.failedCaseInputDetails;
    const failedCaseResponseDetails = payload?.failedCaseResponseDetails;
    const tid = payload?.test_id || msg.testId;

    // Update Stats
    if (status === 'SUCCESS') this.testStats.passed++;
    else this.testStats.failed++;

    if (payload?.httpResponse?.duration) {
      this.testStats.durations.push(payload.httpResponse.duration);
    }

    if (!this.testStats.groupResults[folderDisplayName]) {
      this.testStats.groupResults[folderDisplayName] = { total: 0, passed: 0, failed: 0 };
    }
    this.testStats.groupResults[folderDisplayName].total++;
    if (status === 'SUCCESS') this.testStats.groupResults[folderDisplayName].passed++;
    else this.testStats.groupResults[folderDisplayName].failed++;

    // Render Summary (Dropdown Header)
    const summaryDiv = document.createElement('div');
    summaryDiv.className = `log-run-end status-${status}`;
    summaryDiv.textContent = `> [RUNNER] ${caseName} completed. Status: ${status}`;

    // Render Details (Dropdown Content)
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'log-details-content';

    const navContainer = document.createElement('div');
    navContainer.style.padding = '5px 10px';
    navContainer.style.borderBottom = '1px solid #333';

    const navBtn = document.createElement('button');
    navBtn.className = 'nav-to-case-btn';
    navBtn.innerHTML = `📍 Navigate to this case (ID: ${tid || 'N/A'})`;
    navBtn.style.cursor = tid ? 'pointer' : 'not-allowed';
    navBtn.onclick = e => {
      e.stopPropagation();
      if (tid && window.HttpPageDetail) window.HttpPageDetail.navigateToCase(tid);
    };
    navContainer.appendChild(navBtn);
    detailsDiv.appendChild(navContainer);

    if (validationResults.length > 0) {
      validationResults.forEach(val => {
        const item = document.createElement('div');
        item.className = 'log-validation-item';
        const statusText = val.status || 'N/A';
        const isPassed = statusText === 'Passed' || statusText === 'SUCCESS';
        const icon = isPassed ? '✅' : '❌';
        item.innerHTML = `
          <span class="validation-icon ${isPassed ? 'passed' : 'failed'}">${icon}</span>
          <span class="validation-message">[${statusText}]: ${val.message}</span>
        `;
        detailsDiv.appendChild(item);
      });
    }

    if (status === 'FAILURE' && (failedCaseInputDetails || failedCaseResponseDetails)) {
      const failedSection = document.createElement('div');
      failedSection.className = 'response-body-section failed-details-section';
      failedSection.innerHTML = `
        <h4 class="response-body-header" style="color: #ff9999;">FAILURE DETAILS</h4>
        <pre class="response-body-pre">${
          (failedCaseInputDetails || '') + (failedCaseResponseDetails || '')
        }</pre>
      `;
      detailsDiv.appendChild(failedSection);
    } else if (rawResponseBody) {
      const responseSection = document.createElement('div');
      responseSection.className = 'response-body-section';
      let displayBody = rawResponseBody;
      try {
        displayBody = JSON.stringify(JSON.parse(rawResponseBody), null, 2);
      } catch (e) {}

      responseSection.innerHTML = `
        <h4 class="response-body-header">HTTP Response Body</h4>
        <pre class="response-body-pre">${displayBody}</pre>
      `;
      detailsDiv.appendChild(responseSection);
    }

    summaryDiv.onclick = () => {
      summaryDiv.classList.toggle('open');
      detailsDiv.classList.toggle('show');
    };

    terminalOutput.appendChild(summaryDiv);
    terminalOutput.appendChild(detailsDiv);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  },

  renderFinalDashboard() {
    const terminalOutput = document.getElementById('terminal-output');
    const oldDash = terminalOutput.querySelector('.test-dashboard-container');
    if (oldDash) oldDash.remove();

    const dashboardDiv = document.createElement('div');
    dashboardDiv.className = 'test-dashboard-container';

    let folderRowsHtml = '';
    const resultsEntries = Object.entries(this.testStats.groupResults);

    if (resultsEntries.length === 0) {
      folderRowsHtml = `<div class="coverage-row"><span class="group-name">No data available</span></div>`;
    } else {
      resultsEntries.forEach(([name, stats]) => {
        const percent = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
        folderRowsHtml += `
            <div class="coverage-row">
                <span class="group-name">📁 ${name}</span>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${percent}%"></div>
                    <span class="progress-text">${percent}% Coverage</span>
                </div>
                <div class="group-stats">
                    <span class="total">Total ${stats.total}</span>
                    <span class="passed">Passed ${stats.passed}</span>
                    <span class="failed">Failed ${stats.failed}</span>
                </div>
            </div>`;
      });
    }

    dashboardDiv.innerHTML = `
        <div class="dashboard-coverage-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #fff; font-size: 14px;">Module Coverage</h3>
                <button id="export-report-btn" class="run-btn" style="background-color: #28a745; padding: 5px 12px; font-size: 11px;">
                  📥 Export Report
                </button>
            </div>
            ${folderRowsHtml}
        </div>
        <div class="dashboard-summary-cards">
            <div class="card total-card">
                <div class="label">Total Tests</div>
                <div class="value">${this.testStats.passed + this.testStats.failed}</div>
            </div>
            <div class="card passed-card">
                <div class="label">Passed Tests</div>
                <div class="value">${this.testStats.passed}</div>
            </div>
            <div class="card failed-card">
                <div class="label">Failed Tests</div>
                <div class="value">${this.testStats.failed}</div>
            </div>
            <div class="card time-card">
                <div class="label">Avg Response Time</div>
                <div class="value">${this.calculateAvgTime()}ms</div>
            </div>
        </div>
    `;

    terminalOutput.appendChild(dashboardDiv);
    document
      .getElementById('export-report-btn')
      .addEventListener('click', () => this.exportToHtml());
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  },

  calculateAvgTime() {
    if (!this.testStats.durations || this.testStats.durations.length === 0) return 0;
    const sum = this.testStats.durations.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.testStats.durations.length);
  },

  resetTerminal() {
    const terminalOutput = document.getElementById('terminal-output');
    if (terminalOutput) {
      terminalOutput.innerHTML =
        '<div class="terminal-prompt">> Ready to run selected testcases...</div>';
    }
  },

  async exportToHtml() {
    try {
      const wsNameElement = document.getElementById('workspace-btn');
      const wsName = wsNameElement
        ? wsNameElement.innerText.replace('▾', '').trim()
        : 'Unknown Workspace';
      const now = new Date();
      const timestamp = now.toLocaleString();

      // Tạo tên file: [workspaceName_scenario_currentDateTime.html]
      const fileTimestamp =
        now.getFullYear() +
        ('0' + (now.getMonth() + 1)).slice(-2) +
        ('0' + now.getDate()).slice(-2) +
        '_' +
        ('0' + now.getHours()).slice(-2) +
        ('0' + now.getMinutes()).slice(-2);
      const fileName = `${wsName}_scenario_${fileTimestamp}.html`;

      // Clone nội dung terminal và xóa các nút bấm không cần thiết
      const terminalClone = terminalOutput.cloneNode(true);
      terminalClone.querySelectorAll('button, .select-all-fake').forEach(el => el.remove());

      const finalHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Report: ${wsName}</title>
    <style>
        :root {
    --bg-main: #0f172a;
    --bg-card: #1e293b;
    --text-main: #f1f5f9;
    --text-dim: #94a3b8;
    --success: #22c55e;
    --fail: #ef4444;
    --warn: #f59e0b;
    --info: #3b82f6;
    --accent: #6366f1;
    --border: #334155;
}

body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background-color: white;
    color: var(--text-main);
    margin: 0; padding: 20px; line-height: 1.5;
}

.container {
    max-width: 75vw;
    margin: 0 auto;
    background: black;
    border-radius: 12px;
    padding: 30px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
}

/* --- 1. DASHBOARD & CARDS --- */
.test-dashboard-container {
    margin-bottom: 30px;
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.dashboard-summary-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
}

.card {
    padding: 20px;
    border-radius: 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--border);
    text-align: center;
}

.card .label { color: var(--text-dim); font-size: 12px; text-transform: uppercase; margin-bottom: 8px; }
.card .value { font-size: 24px; font-weight: bold; }
.passed-card .value { color: var(--success); }
.failed-card .value { color: var(--fail); }

/* --- 2. PROGRESS BARS (Module Coverage) --- */
.coverage-row {
    background: rgba(0,0,0,0.2);
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 15px;
}

.group-name { flex: 1; font-weight: 500; font-size: 14px; }

.progress-bar-container {
    flex: 2;
    height: 10px;
    background: #334155;
    border-radius: 5px;
    position: relative;
    overflow: hidden;
}

.progress-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--success));
    transition: width 0.5s ease;
}

/* --- 3. TERMINAL LINES & LOG LEVELS --- */
.report-body {
    background: #000;
    padding: 15px;
    border-radius: 8px;
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
    border: 1px solid var(--border);
}

.terminal-line { margin: 4px 0; border-left: 3px solid transparent; padding-left: 10px; }
.log-INFO { border-left-color: var(--info); color: #e2e8f0; }
.log-ERROR, .log-FATAL { border-left-color: var(--fail); color: #fda4af; }
.log-PROMPT { color: var(--accent); font-weight: bold; margin: 30px 0; }

/* --- 4. RUN END (DROPDOWN) --- */
.log-run-end {
    margin-top: 10px;
    padding: 12px;
    background: #1e293b;
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    display: flex;
    align-items: center;
}

.status-SUCCESS { border-left: 4px solid var(--success); }
.status-FAILURE { border-left: 4px solid var(--fail); }

.log-details-content {
    display: none;
    background: #0f172a;
    border: 1px solid var(--border);
    border-top: none;
    padding: 15px;
    border-bottom-left-radius: 6px;
    border-bottom-right-radius: 6px;
}

.log-details-content.show { display: block; }

/* --- 5. VALIDATION & JSON --- */
.log-validation-item {
    padding: 6px 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    display: flex;
    gap: 10px;
}

.validation-icon.passed { color: var(--success); }
.validation-icon.failed { color: var(--fail); }

.response-body-pre {
    background: #1a1a1a;
    padding: 15px;
    border-radius: 6px;
    color: #a5f3fc;
    overflow-x: auto;
    max-height: 400px;
    border: 1px solid #333;
    font-size: 12px;
}

.nav-to-case-btn {
    background: transparent;
    border: 1px solid var(--accent);
    color: var(--accent);
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 11px;
    margin-bottom: 10px;
}

/* Hide action buttons in Static Report */
#export-report-btn, .nav-to-case-btn {
    display: none; 
}

.meta-info{
    margin-bottom: 30px;
}

.group-stats{
    width: 30vw;
    display: flex;
    justify-content: space-evenly;
}
    </style>
</head>
<body>
    <div class="container">
        <div class="report-header">
            <div>
                <h1>Tunview Scenario Report</h1>
                <div style="color: var(--info)">Workspace: ${wsName}</div>
            </div>
            <div class="meta-info">
                Executed At: ${timestamp} (MM/DD/YYYY, HH:MM:SS)<br>
                Status: Completed
            </div>
        </div>

        <div class="report-body">
            ${terminalClone.innerHTML}
        </div>
        
        <footer style="margin-top: 50px; text-align: center; color: var(--text-dim); font-size: 12px; padding: 20px; border-top: 1px solid var(--border-color);">
            Generated by Tunview Core Framework &copy; 2025
        </footer>
    </div>

    <script>
        // Xử lý sự kiện click để Dropdown nội dung chi tiết
        document.addEventListener('DOMContentLoaded', () => {
            const summaries = document.querySelectorAll('.log-run-end');
            
            summaries.forEach(summary => {
                summary.addEventListener('click', function() {
                    // Xoay mũi tên
                    this.classList.toggle('active');
                    
                    // Tìm phần tử nội dung ngay kế tiếp
                    const detail = this.nextElementSibling;
                    if (detail && detail.classList.contains('log-details-content')) {
                        detail.classList.toggle('show');
                    }
                });
            });
        });
    </script>
</body>
</html>`;

      // Gọi IPC lưu file
      const result = await window.ipcAPI.invoke('export-report-file', {
        fileName: fileName,
        content: finalHtml,
      });

      if (result.success) showNotification('Report exported successfully!', 'success');
    } catch (err) {
      showNotification('Export failed: ' + err.message, 'error');
    }
  },
};
