window.HttpPageUI = {
  // --- STATE ---
  resizeTimer: null,
  isResizing: false,
  rightClickedGroup: null,
  rightClickedModule: null,
  rightClickedCaseName: null,
  deleteType: null,
  currentConfig: null,

  init() {
    this.bindSplitter();
    this.bindModuleActions();
    this.bindContextMenu();
    this.bindCaseForm();
    this.bindConfigManager();
    this.bindGlobalInteractions();
    this.initComponentSizeOnStart();
    this.bindModalCancelButtons();
  },

  bindSplitter() {
    const httpSplitter = document.getElementById('http-splitter');
    const httpPage = document.getElementById('page-http');
    const httpView = httpPage.querySelector('.http-view');
    const httpRun = httpPage.querySelector('.http-run');

    if (!httpSplitter || !httpPage) return;

    httpSplitter.addEventListener('mousedown', e => {
      this.isResizing = true;
      const boundingRect = httpPage.getBoundingClientRect();
      document.body.style.cursor = 'ns-resize';

      const moveHandler = me => {
        if (!this.isResizing) return;
        const totalHeight = boundingRect.height;
        const splitterH = httpSplitter.offsetHeight;

        // Tính toán vị trí mới
        let newViewHeight = me.clientY - boundingRect.top;
        let remainRunHeight = totalHeight - newViewHeight - splitterH;

        // Ràng buộc Min-Height (100px cho View, 50px cho Run)
        if (newViewHeight < 100) {
          newViewHeight = 100;
          remainRunHeight = totalHeight - 100 - splitterH;
        }
        if (remainRunHeight < 50) {
          remainRunHeight = 50;
          newViewHeight = totalHeight - 50 - splitterH;
        }

        httpView.style.height = `${newViewHeight}px`;
        httpRun.style.height = `${remainRunHeight}px`;
      };

      const upHandler = () => {
        this.isResizing = false;
        document.body.style.cursor = 'default';
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', upHandler);
      };
      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('mouseup', upHandler);
    });

    window.addEventListener('resize', () => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => this.initializeSplitHeights(), 20);
    });
  },

  initializeSplitHeights() {
    const httpPage = document.getElementById('page-http');
    // Cập nhật selector để tìm class bên trong page-http
    const httpView = httpPage?.querySelector('.http-view');
    const httpRun = httpPage?.querySelector('.http-run');
    const httpSplitter = document.getElementById('http-splitter');

    if (!httpPage || !httpView || !httpRun) return;

    const initialTotalHeight = httpPage.offsetHeight;
    const splitterHeight = httpSplitter.offsetHeight;
    const minHeight = 50;
    const tolerance = 5;
    let newHttpViewHeight;
    let newHttpRunHeight;

    // --- GIỮ NGUYÊN LOGIC FILE CŨ CỦA BẠN ---
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
      // Logic "Min khi khởi động" nằm ở đây
      const defaultRunHeight = minHeight;
      newHttpRunHeight = defaultRunHeight;
      newHttpViewHeight = initialTotalHeight - splitterHeight - defaultRunHeight;
    }

    newHttpViewHeight = Math.max(newHttpViewHeight, minHeight);
    newHttpRunHeight = Math.max(newHttpRunHeight, minHeight);

    if (newHttpViewHeight + newHttpRunHeight + splitterHeight > initialTotalHeight) {
      newHttpViewHeight = initialTotalHeight - splitterHeight - newHttpRunHeight;
    }

    // Thực thi gán style
    httpView.style.height = `${newHttpViewHeight}px`;
    httpRun.style.height = `${newHttpRunHeight}px`;
  },

  initComponentSizeOnStart() {
    const httpPage = document.getElementById('page-http');
    if (httpPage) {
      const observer = new ResizeObserver(() => {
        if (httpPage.offsetHeight > 0) {
          this.initializeSplitHeights();
          observer.disconnect();
        }
      });
      observer.observe(httpPage);
    }
  },

  bindModuleActions() {
    const moduleModal = document.getElementById('module-modal');
    const moduleNameInput = document.getElementById('module-name-input');

    document.getElementById('new-module-btn').onclick = () => {
      moduleNameInput.value = '';
      moduleModal.classList.remove('hidden');
      moduleNameInput.focus();
      this.closeContextMenu();
    };

    document.getElementById('save-module-btn').onclick = async () => {
      const newName = moduleNameInput.value.trim();
      if (!newName) return window.AppUI.showNotification('Module name cannot be empty', 'warning');

      // Lấy data từ TreeView module
      let testcases = window.HttpPageTreeView.currentTestcases || {};
      if (testcases[newName])
        return window.AppUI.showNotification('Module already exists', 'error');

      testcases[newName] = [];
      await this.saveAndRefreshTree(`Module "${newName}" created`, testcases);
      moduleModal.classList.add('hidden');
      this.closeContextMenu();
    };

    document.getElementById('ctx-new-group').onclick = () => {
      if (!this.rightClickedModule) return;
      document.getElementById(
        'target-module-label'
      ).textContent = `Adding to: ${this.rightClickedModule}`;
      document.getElementById('group-name-input').value = '';
      document.getElementById('group-modal').classList.remove('hidden');
      document.getElementById('group-name-input').focus();
      this.closeContextMenu();
    };

    document.getElementById('save-group-btn').onclick = async () => {
      const gName = document.getElementById('group-name-input').value.trim();
      if (!gName) return window.AppUI.showNotification('Group name required', 'warning');

      let testcases = window.HttpPageTreeView.currentTestcases;
      if (testcases[this.rightClickedModule].some(g => g.group === gName)) {
        return window.AppUI.showNotification('Group exists', 'error');
      }
      testcases[this.rightClickedModule].push({ group: gName, cases: [] });
      await this.saveAndRefreshTree(`Group "${gName}" added`, testcases);
      document.getElementById('group-modal').classList.add('hidden');
      this.closeContextMenu();
    };
  },

  bindContextMenu() {
    const menu = document.getElementById('context-menu');
    const treeRoot = document.getElementById('http-tree-root');

    // 1. Xử lý hiển thị Menu khi Chuột phải vào Tree
    treeRoot.oncontextmenu = e => {
      const node = e.target.closest('.tree-node');
      if (!node) return;

      e.preventDefault();
      e.stopPropagation();

      const { type, name, moduleName, groupName } = node.dataset;

      this.rightClickedModule = moduleName;
      this.rightClickedGroup = groupName;
      this.rightClickedCaseName = type === 'case' ? name : null;

      menu.classList.remove('hidden');
      menu.style.display = 'block';

      // Hiển thị/Ẩn các option tương ứng
      document.getElementById('ctx-new-group').style.display = type === 'module' ? 'block' : 'none';
      document.getElementById('ctx-delete-module').style.display = type === 'module' ? 'block' : 'none';
      document.getElementById('ctx-new-case').style.display = type === 'group' ? 'block' : 'none';
      document.getElementById('ctx-delete-group').style.display = type === 'group' ? 'block' : 'none';
      document.getElementById('ctx-delete-case').style.display = type === 'case' ? 'block' : 'none';

      menu.style.left = `${Math.min(e.clientX, window.innerWidth - menu.offsetWidth)}px`;
      menu.style.top = `${Math.min(e.clientY, window.innerHeight - menu.offsetHeight)}px`;
    };

    // 2. Gán sự kiện cho các nút TRONG menu để mở Modal
    document.getElementById('ctx-delete-module').onclick = () => {
      this.showDelModal('module', this.rightClickedModule);
      this.closeContextMenu();
    };
    document.getElementById('ctx-delete-group').onclick = () => {
      this.showDelModal('group', this.rightClickedGroup);
      this.closeContextMenu();
    };
    document.getElementById('ctx-delete-case').onclick = () => {
      this.showDelModal('case', this.rightClickedCaseName);
      this.closeContextMenu();
    };

    // 3. ĐOẠN NÀY LÀ QUAN TRỌNG NHẤT: Xử lý khi nhấn nút "Confirm" trên Modal xóa
    const confirmBtn = document.getElementById('confirm-delete-btn');
    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        let testcases = window.HttpPageTreeView.currentTestcases;

        if (this.deleteType === 'module') {
          delete testcases[this.rightClickedModule];
        } 
        else if (this.deleteType === 'group') {
          if (testcases[this.rightClickedModule]) {
            testcases[this.rightClickedModule] = testcases[this.rightClickedModule].filter(
              g => g.group !== this.rightClickedGroup
            );
          }
        } 
        else if (this.deleteType === 'case') {
          const group = testcases[this.rightClickedModule]?.find(g => g.group === this.rightClickedGroup);
          if (group) {
            group.cases = group.cases.filter((c, idx) => {
              const cName = c.name || `Case ${idx + 1}`;
              return cName !== this.rightClickedCaseName;
            });
          }
        }

        // Lưu xuống file và làm mới cây thư mục
        await this.saveAndRefreshTree(`${this.deleteType} deleted`, testcases);
        
        // Đóng modal và menu
        document.getElementById('delete-confirm-modal').classList.add('hidden');
        this.closeContextMenu();

        // Xóa trắng vùng Detail nếu Case đang xem vừa bị xóa
        if (this.deleteType === 'case' && window.HttpPageDetail) {
           document.getElementById('http-detail-content').innerHTML = '';
           document.getElementById('http-save-btn').style.display = 'none';
           // Cập nhật tiêu đề detail về mặc định
           const titleEl = document.querySelector('.detail-header h3');
           if (titleEl) titleEl.textContent = 'Select a testcase';
        }
      };
    }
  },

  showDelModal(type, name) {
    this.deleteType = type;
    document.getElementById(
      'delete-confirm-message'
    ).innerHTML = `Delete ${type} <strong>"${name}"</strong>?`;
    document.getElementById('delete-confirm-modal').classList.remove('hidden');
  },

  bindCaseForm() {
    const modal = document.getElementById('case-modal');

    document.getElementById('ctx-new-case').onclick = e => {
      e.stopPropagation();
      modal.dataset.currentModule = this.rightClickedModule;
      modal.dataset.currentGroup = this.rightClickedGroup;
      document.getElementById('target-module-label').textContent = this.rightClickedModule;
      document.getElementById('target-group-label').textContent = this.rightClickedGroup;
      this.resetCaseForm();
      modal.classList.remove('hidden');
      this.closeContextMenu();
    };

    document.getElementById('add-validation-btn').onclick = () => {
      const tbody = document.querySelector('#validation-table tbody');
      const row = document.createElement('tr');
      row.innerHTML = `
                <td><input type="text" class="no-margin-bottom v-field" placeholder="status"></td>
                <td><input type="text" class="no-margin-bottom v-data" placeholder="success"></td>
                <td><button type="button" class="delete-row-btn">x</button></td>`;

      row.querySelectorAll('input').forEach(input => {
        input.onkeypress = e => {
          if (e.key === '|') e.preventDefault();
        };
        input.oninput = e => {
          e.target.value = e.target.value.replace(/\|/g, '');
        };
      });
      row.querySelector('.delete-row-btn').onclick = () => row.remove();
      tbody.appendChild(row);
    };

    document.getElementById('save-case-btn').onclick = async () => {
      const tMod = modal.dataset.currentModule;
      const tGrp = modal.dataset.currentGroup;
      const testId = document.getElementById('case-test-id').value.trim();
      const api = document.getElementById('case-api').value.trim();
      const expectedCode = document.getElementById('case-code').value.trim();

      if (!testId || !api || !expectedCode)
        return window.AppUI.showNotification('Fill required fields', 'warning');

      let fields = [],
        dataArr = [],
        hasSpace = false;
      document.querySelectorAll('#validation-table tbody tr').forEach(row => {
        const f = row.querySelector('.v-field').value.trim();
        const d = row.querySelector('.v-data').value.trim();
        if (f) {
          if (/\s/.test(f)) hasSpace = true;
          fields.push(f);
          dataArr.push(d || '');
        }
      });
      if (hasSpace) return window.AppUI.showNotification('Field must not contain spaces!', 'error');

      const newCase = {
        test_id: isNaN(testId) ? testId : parseInt(testId),
        name: document.getElementById('case-name').value.trim() || testId,
        method: document.getElementById('case-method').value,
        api: api,
        auth_token: document.getElementById('case-auth').value,
        expected_code: expectedCode,
        expected_response_time:
          document.getElementById('case-response-time').value.trim() || undefined,
      };
      if (fields.length > 0) {
        newCase.custom_expected_field = fields.join('|');
        newCase.custom_expected_data = dataArr.join('|');
      }

      if (['POST', 'PUT', 'PATCH'].includes(newCase.method)) {
        const bVal = document.getElementById('case-body').value.trim();
        try {
          newCase.body = bVal ? JSON.parse(bVal) : {};
        } catch (e) {
          return window.AppUI.showNotification('Invalid JSON Body', 'error');
        }
      }

      const testcases = window.HttpPageTreeView.currentTestcases;
      const groupObj = testcases[tMod].find(g => g.group === tGrp);
      if (groupObj.cases.some(c => String(c.test_id) === String(testId))) {
        return window.AppUI.showNotification('Test ID exists', 'error');
      }
      groupObj.cases.push(newCase);
      await this.saveAndRefreshTree(`Case ${testId} saved`, testcases);
      modal.classList.add('hidden');
    };
  },

  bindConfigManager() {
    document.getElementById('edit-config-btn').onclick = async () => {
      this.currentConfig = await window.ipcAPI.invoke('read-zip-file', {
        fileName: window.PATHS.TVWS_HTTP_SCENARIO_CONFIG,
      });
      document.getElementById('cfg-max-retries').value = this.currentConfig.max_retries || 0;
      document.getElementById('cfg-connect-timeout').value =
        this.currentConfig.connect_timeout || 0;
      document.getElementById('cfg-read-timeout').value = this.currentConfig.read_timeout || 0;
      this.renderEnvList(this.currentConfig.envs || []);
      document.getElementById('config-modal').classList.remove('hidden');
    };

    document.getElementById('add-env-btn').onclick = () => {
      const list = document.getElementById('env-list-container');
      const active = list.children.length === 0;
      this.renderEnvItem({ name: 'new_env', url: 'http://', active: active });
    };

    document.getElementById('save-config-btn').onclick = async () => {
      const config = {
        max_retries: parseInt(document.getElementById('cfg-max-retries').value),
        connect_timeout: parseInt(document.getElementById('cfg-connect-timeout').value),
        read_timeout: parseInt(document.getElementById('cfg-read-timeout').value),
        envs: [],
      };
      document.querySelectorAll('.env-item').forEach(row => {
        config.envs.push({
          name: row.querySelector('.env-name').value.trim(),
          url: row.querySelector('.env-url').value.trim(),
          active: row.querySelector('.radio-active').checked,
        });
      });
      await window.ipcAPI.invoke('write-zip-file', {
        fileName: window.PATHS.TVWS_HTTP_SCENARIO_CONFIG,
        content: config,
      });
      window.AppUI.showNotification('Config saved', 'success');
      document.getElementById('config-modal').classList.add('hidden');
    };
  },

  renderEnvList(envs) {
    document.getElementById('env-list-container').innerHTML = '';
    envs.forEach(env => this.renderEnvItem(env));
  },

  renderEnvItem(env) {
    const container = document.getElementById('env-list-container');
    const row = document.createElement('div');
    row.className = `env-item ${env.active ? 'active-env' : ''}`;
    row.innerHTML = `
            <input type="radio" name="active-env" class="radio-active" ${
              env.active ? 'checked' : ''
            }>
            <input type="text" class="env-name no-margin-bottom" value="${env.name}">
            <input type="text" class="env-url no-margin-bottom" value="${env.url}">
            <button class="btn-delete-env">&times;</button>`;

    row.querySelector('.radio-active').onchange = () => {
      document.querySelectorAll('.env-item').forEach(el => el.classList.remove('active-env'));
      row.classList.add('active-env');
    };
    row.querySelector('.btn-delete-env').onclick = () => {
      const wasActive = row.querySelector('.radio-active').checked;
      row.remove();
      if (wasActive && container.firstChild) {
        const r = container.querySelector('.radio-active');
        r.checked = true;
        r.closest('.env-item').classList.add('active-env');
      }
    };
    container.appendChild(row);
  },

  async saveAndRefreshTree(msg, content) {
    try {
      await window.ipcAPI.invoke('write-zip-file', {
        fileName: window.PATHS.TVWS_HTTP_SCENARIO_TESTCASE,
        content,
      });
      window.AppUI.showNotification(msg, 'success');
      await window.HttpPageTreeView.loadHttpTree();
    } catch (e) {
      window.AppUI.showNotification(e.message, 'error');
    }
  },

  closeContextMenu() {
    const m = document.getElementById('context-menu');
    m.classList.add('hidden');
    m.style.display = 'none';
  },

  resetCaseForm() {
    ['case-name', 'case-test-id', 'case-api', 'case-body', 'case-response-time'].forEach(
      id => (document.getElementById(id).value = '')
    );
    document.querySelector('#validation-table tbody').innerHTML = '';
  },

  bindGlobalInteractions() {
    window.addEventListener('mousedown', e => {
      if (!document.getElementById('context-menu').contains(e.target)) this.closeContextMenu();
    });
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        this.closeContextMenu();
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
      }
    });
  },

  bindModalCancelButtons() {
    // Generic: any button with class "modal-cancel" closes its parent modal and resets inputs
    document.querySelectorAll('.modal .modal-cancel').forEach(btn => {
      btn.onclick = () => {
        const modal = btn.closest('.modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.querySelectorAll('input[type="text"], textarea').forEach(i => (i.value = ''));
      };
    });

    // Fallback for common specific IDs (if present in HTML)
    [
      'cancel-module-btn',
      'cancel-group-btn',
      'cancel-case-btn',
      'cancel-config-btn',
      'cancel-delete-btn',
    ].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.onclick = () => {
        const modal = el.closest('.modal');
        if (modal) modal.classList.add('hidden');
        if (id === 'cancel-case-btn') this.resetCaseForm();
      };
    });
  },
};
