// ==================== ХРАНИЛИЩЕ ПРОЕКТОВ ====================
// IndexedDB + localStorage для сохранения проектов планов эвакуации
const Storage = (function() {
  'use strict';

  const LS_PROJECTS = 'pe_projects';
  const LS_CURRENT = 'pe_current';
  let _db = null;

  function dbOpen() {
    if (_db) return Promise.resolve(_db);
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('no-indexeddb'));
    return new Promise(function(resolve, reject) {
      var req = indexedDB.open('pe_store', 1);
      req.onupgradeneeded = function() {
        var db = req.result;
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      };
      req.onsuccess = function() { _db = req.result; resolve(_db); };
      req.onerror = function() { reject(req.error); };
    });
  }

  function idbPut(store, obj) {
    return dbOpen().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(obj);
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { reject(tx.error); };
      });
    }).catch(function() {});
  }

  function idbGet(store, key) {
    return dbOpen().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(store, 'readonly');
        var req = tx.objectStore(store).get(key);
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error); };
      });
    }).catch(function() { return undefined; });
  }

  function idbDelete(store, key) {
    return dbOpen().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { reject(tx.error); };
      });
    }).catch(function() {});
  }

  function loadProjectList() {
    try { return JSON.parse(localStorage.getItem(LS_PROJECTS)) || []; }
    catch (e) { return []; }
  }

  function saveProjectList(list) {
    try { localStorage.setItem(LS_PROJECTS, JSON.stringify(list)); } catch (e) {}
  }

  function defaultProject() {
    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: 'Новый проект',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      bgLayers: [],
      objects: [],
      paths: { main: [], reserve: [] },
      symbols: [],
      labels: [],
      textPart: null
    };
  }

  function saveProject(project) {
    project.updatedAt = Date.now();
    // Сохраняем в IndexedDB (полная копия с подложками)
    idbPut('projects', project);
    // Обновляем список метаданных в localStorage
    var list = loadProjectList();
    var idx = list.findIndex(function(p) { return p.id === project.id; });
    var meta = {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    };
    if (idx >= 0) { list[idx] = meta; } else { list.unshift(meta); }
    if (list.length > 50) list = list.slice(0, 50);
    saveProjectList(list);
    // Текущий проект
    try { localStorage.setItem(LS_CURRENT, project.id); } catch (e) {}
  }

  function loadProject(id) {
    return idbGet('projects', id);
  }

  function deleteProject(id) {
    idbDelete('projects', id);
    var list = loadProjectList().filter(function(p) { return p.id !== id; });
    saveProjectList(list);
  }

  function exportJSON(project) {
    var blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (project.name || 'plan_evacuation') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(file, callback) {
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var project = JSON.parse(e.target.result);
        if (project.id) callback(project);
        else alert('Неверный формат файла');
      } catch (err) { alert('Ошибка чтения файла: ' + err.message); }
    };
    reader.readAsText(file);
  }

  return {
    defaultProject: defaultProject,
    saveProject: saveProject,
    loadProject: loadProject,
    deleteProject: deleteProject,
    loadProjectList: loadProjectList,
    exportJSON: exportJSON,
    importJSON: importJSON
  };
})();
