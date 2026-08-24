// ==================== ГЛАВНОЕ ПРИЛОЖЕНИЕ ====================
// Навигация, стартовый экран, привязка событий
(function() {
  'use strict';

  var currentProject = null;

  // ========== Undo/Redo система ==========
  var HistoryManager = (function() {
    var stack = [];
    var pointer = -1;
    var maxSize = 50;

    function getState() {
      return CanvasEditor.getData();
    }

    function setState(state) {
      CanvasEditor.setData(state);
    }

    function push() {
      var state = getState();
      if (!state) return;
      stack = stack.slice(0, pointer + 1);
      stack.push(JSON.stringify(state));
      if (stack.length > maxSize) {
        stack.shift();
      } else {
        pointer++;
      }
      updateButtons();
    }

    function undo() {
      if (pointer > 0) {
        pointer--;
        setState(JSON.parse(stack[pointer]));
        updateButtons();
        return true;
      }
      return false;
    }

    function redo() {
      if (pointer < stack.length - 1) {
        pointer++;
        setState(JSON.parse(stack[pointer]));
        updateButtons();
        return true;
      }
      return false;
    }

    function clear() {
      stack = [];
      pointer = -1;
      updateButtons();
    }

    function updateButtons() {
      var undoBtn = document.getElementById('btnUndo');
      var redoBtn = document.getElementById('btnRedo');
      if (undoBtn) undoBtn.disabled = pointer <= 0;
      if (redoBtn) redoBtn.disabled = pointer >= stack.length - 1;
    }

    function init() {
      document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) { redo(); } else { undo(); }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
          e.preventDefault();
          redo();
        }
      });
    }

    return { push: push, undo: undo, redo: redo, clear: clear, init: init };
  })();

  // ========== Дебаунс функция ==========
  function debounce(fn, delay) {
    var timer = null;
    return function() {
      var args = arguments;
      var context = this;
      clearTimeout(timer);
      timer = setTimeout(function() {
        fn.apply(context, args);
      }, delay);
    };
  }

  // ========== Навигация ==========
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
    var screen = document.getElementById(id);
    if (screen) screen.classList.add('active');
    // Обновляем активную вкладку на всех экранах
    var tab = id === 'editorScreen' ? 'editor' : id === 'textScreen' ? 'text' : 'export';
    document.querySelectorAll('.header-tab').forEach(function(t) {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
  }

  function switchTab(target) {
    if (target === 'editor') {
      showScreen('editorScreen');
      initCanvas();
    } else if (target === 'text') {
      showScreen('textScreen');
    } else if (target === 'export') {
      showScreen('exportScreen');
    }
  }

  // ========== Стартовый экран ==========
  function initStartScreen() {
    renderRecentProjects();

    document.getElementById('btnNewProject').addEventListener('click', function() {
      currentProject = Storage.defaultProject();
      document.getElementById('projectName').value = currentProject.name;
      showScreen('editorScreen');
      initCanvas();
    });

    document.getElementById('btnLoadProject').addEventListener('click', function() {
      document.getElementById('projectFileLoader').click();
    });

    document.getElementById('projectFileLoader').addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      Storage.importJSON(file, function(project) {
        currentProject = project;
        document.getElementById('projectName').value = project.name;
        showScreen('editorScreen');
        initCanvas();
        if (project.canvasData) {
          CanvasEditor.setData(project.canvasData);
          CanvasEditor.fitToAll();
        }
        if (project.textPart) {
          TextPart.setFormData(project.textPart);
        }
      });
      e.target.value = '';
    });
  }

  function renderRecentProjects() {
    var list = Storage.loadProjectList();
    var container = document.getElementById('recentProjects');
    container.innerHTML = '';
    if (list.length === 0) {
      container.innerHTML = '<div style="font-size:12px;color:#888;padding:4px 0">Нет сохранённых проектов</div>';
      return;
    }
    list.forEach(function(p) {
      var item = document.createElement('div');
      item.className = 'recent-item';
      var date = new Date(p.updatedAt);
      item.innerHTML = '<span class="ri-name">' + esc(p.name) + '</span>' +
        '<span class="ri-meta">' + date.toLocaleDateString('ru') + '</span>' +
        '<button class="ri-del" title="Удалить">×</button>';
      item.querySelector('.ri-name').addEventListener('click', function() {
        Storage.loadProject(p.id).then(function(proj) {
          if (proj) {
            currentProject = proj;
            document.getElementById('projectName').value = proj.name;
            showScreen('editorScreen');
            initCanvas();
            if (proj.canvasData) {
              CanvasEditor.setData(proj.canvasData);
              CanvasEditor.fitToAll();
            }
            if (proj.textPart) {
              TextPart.setFormData(proj.textPart);
            }
          }
        });
      });
      item.querySelector('.ri-del').addEventListener('click', function(e) {
        e.stopPropagation();
        if (confirm('Удалить проект «' + p.name + '»?')) {
          Storage.deleteProject(p.id);
          renderRecentProjects();
        }
      });
      container.appendChild(item);
    });
  }

  // ========== Редактор ==========
  function initCanvas() {
    var cv = document.getElementById('cv');
    if (cv && !cv._initialized) {
      CanvasEditor.init(cv);
      cv._initialized = true;
    }
  }

  function initEditor() {
    // Инициализация Undo/Redo
    HistoryManager.init();

    // Кнопка «На главную» (редактор)
    document.getElementById('btnHome').addEventListener('click', function() {
      saveCurrentProject();
      showScreen('startScreen');
      renderRecentProjects();
    });

    // Сохранение
    document.getElementById('btnSaveProject').addEventListener('click', function() {
      saveCurrentProject();
      alert('Проект сохранён!');
    });

    // Название проекта
    document.getElementById('projectName').addEventListener('input', function(e) {
      if (currentProject) currentProject.name = e.target.value;
    });

    // Переключение вкладок — ВСЕ кнопки .header-tab на ВСЕХ экранах
    document.querySelectorAll('.header-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        switchTab(tab.dataset.tab);
      });
    });

    // Инструменты
    var toolButtons = {
      btnEditor: 'editor',
      btnLabel: 'label',
      btnPathMain: 'pathMain', btnPathReserve: 'pathReserve', btnSymbol: 'symbol'
    };
    Object.keys(toolButtons).forEach(function(btnId) {
      var btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('click', function() {
          CanvasEditor.setTool(toolButtons[btnId]);
        });
      }
    });

    // Кнопка «Рисование» — открывает выпадающее меню
    var drawBtn = document.getElementById('btnDraw');
    var drawMenu = document.getElementById('drawMenu');
    if (drawBtn && drawMenu) {
      drawBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (drawMenu.classList.contains('show')) {
          drawMenu.classList.remove('show');
        } else {
          var rect = drawBtn.getBoundingClientRect();
          drawMenu.style.left = (rect.right + 6) + 'px';
          drawMenu.style.top = rect.top + 'px';
          drawMenu.classList.add('show');
        }
      });
      // Пункты выпадающего меню
      drawMenu.querySelectorAll('.tb-dd-item').forEach(function(item) {
        item.addEventListener('click', function(e) {
          e.stopPropagation();
          var drawType = item.dataset.draw;
          CanvasEditor.setTool(drawType);
          drawMenu.classList.remove('show');
        });
      });
    }
    // Закрытие меню при клике вне
    document.addEventListener('click', function() {
      if (drawMenu) drawMenu.classList.remove('show');
    });

    // Обновление видимости панели свойств рисования при смене инструмента
    function updateDrawPropsVisibility() {
      if (drawPropsPanel) {
        var currentTool = CanvasEditor.getTool ? CanvasEditor.getTool() : '';
        var isDrawTool = ['wall', 'partition', 'line'].indexOf(currentTool) >= 0;
        drawPropsPanel.style.display = isDrawTool ? 'flex' : 'none';
      }
    }

    // Вызываем updateDrawPropsVisibility при смене инструмента
    var originalSetTool = CanvasEditor.setTool;
    CanvasEditor.setTool = function(t) {
      originalSetTool.call(CanvasEditor, t);
      updateDrawPropsVisibility();
    };

    // Панель свойств рисования
    var drawColorEl = document.getElementById('drawColor');
    var drawWidthEl = document.getElementById('drawWidth');
    var drawWidthVal = document.getElementById('drawWidthVal');
    if (drawColorEl) {
      drawColorEl.addEventListener('input', function() {
        CanvasEditor.setDrawColor(drawColorEl.value);
        HistoryManager.push();
      });
    }
    if (drawWidthEl) {
      drawWidthEl.addEventListener('input', function() {
        CanvasEditor.setDrawWidth(parseInt(drawWidthEl.value));
        if (drawWidthVal) drawWidthVal.textContent = drawWidthEl.value;
      });
    }

    // Подложка
    document.getElementById('btnBgImage').addEventListener('click', function() {
      document.getElementById('imageLoader').click();
    });
    document.getElementById('imageLoader').addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        var img = new Image();
        img.onload = function() {
          var layer = CanvasEditor.addBgImage(img, file.name);
          layer.dataUrl = ev.target.result;
          CanvasEditor.fitToAll();
        };
        img.onerror = function() {
          alert('Ошибка загрузки изображения: ' + file.name);
        };
        img.src = ev.target.result;
      };
      reader.onerror = function() {
        alert('Ошибка чтения файла: ' + file.name);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });

    // Очистка
    document.getElementById('btnClear').addEventListener('click', function() {
      CanvasEditor.clearAll();
      HistoryManager.clear();
    });

    // Горячие клавиши — сохранение Ctrl+S, Delete для удаления
    document.addEventListener('keydown', function(e) {
      // Ctrl+S — сохранение
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCurrentProject();
      }
      // Delete — удаление выделенного объекта
      if (e.key === 'Delete') {
        var sel = CanvasEditor.getSelectedObject ? CanvasEditor.getSelectedObject() : null;
        if (sel) {
          CanvasEditor.deleteSelected();
          HistoryManager.push();
        }
      }
    });

    // Пожарные символы
    document.getElementById('btnSymbol').addEventListener('click', function() {
      var panel = document.getElementById('symbolPanel');
      panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
      renderSymbolList();
    });
    document.getElementById('symbolPanelClose').addEventListener('click', function() {
      document.getElementById('symbolPanel').style.display = 'none';
    });

    // Текстовая часть — кнопки
    document.getElementById('btnTextHome').addEventListener('click', function() {
      showScreen('startScreen');
      renderRecentProjects();
    });
    document.getElementById('btnSaveText').addEventListener('click', function() {
      saveCurrentProject();
      alert('Текстовая часть сохранена!');
    });

    // Экспорт
    document.getElementById('btnExportHome').addEventListener('click', function() {
      showScreen('startScreen');
      renderRecentProjects();
    });
    document.getElementById('btnPreview').addEventListener('click', function() {
      generatePreview();
    });
    document.getElementById('btnExportPDF').addEventListener('click', function() {
      var canvasData = CanvasEditor.getData();
      var textData = TextPart.getFormData();
      ExportPDF.exportToPDF(canvasData, textData);
    });
    document.getElementById('btnExportPNG').addEventListener('click', function() {
      CanvasEditor.exportPNG();
    });
    document.getElementById('btnExportJSON').addEventListener('click', function() {
      saveCurrentProject();
      Storage.exportJSON(currentProject);
    });
  }

  function renderSymbolList() {
    var list = document.getElementById('symbolList');
    list.innerHTML = '';
    FireSymbols.getAll().forEach(function(sym) {
      var item = document.createElement('div');
      item.className = 'symbol-item';
      item.innerHTML = '<div class="sym-icon">' + sym.icon + '</div><span class="sym-name">' + sym.name + '</span>';
      item.addEventListener('click', function() {
        window._selectedSymbolType = sym.id;
        document.querySelectorAll('.symbol-item').forEach(function(s) { s.classList.remove('active'); });
        item.classList.add('active');
        CanvasEditor.setTool('symbol');
      });
      list.appendChild(item);
    });
  }

  function generatePreview() {
    var wrap = document.getElementById('previewWrap');
    var canvasData = CanvasEditor.getData();
    var textData = TextPart.getFormData();
    var html = ExportPDF.generateHTML(canvasData, textData);
    var iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '600px';
    iframe.style.border = 'none';
    wrap.innerHTML = '';
    wrap.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
  }

  function saveCurrentProject() {
    if (!currentProject) return;
    currentProject.name = document.getElementById('projectName').value || 'Без названия';
    currentProject.canvasData = CanvasEditor.getData();
    currentProject.textPart = TextPart.getFormData();
    Storage.saveProject(currentProject);
  }

  function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ========== Инициализация ==========
  document.addEventListener('DOMContentLoaded', function() {
    initStartScreen();
    initEditor();
    showScreen('startScreen');
  });

})();
