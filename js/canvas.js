// ==================== CANVAS РЕДАКТОР ====================
// Подложка, стены, пути эвакуации, символы
const CanvasEditor = (function() {
  'use strict';

  var canvas, ctx;
  var W = 0, H = 0, DPR = 1;
  var zoom = 1, panX = 0, panY = 0;
  var ZOOM_MIN = 0.05, ZOOM_MAX = 20;

  // Состояние
  var tool = 'select'; // select, editor, wall, partition, line, label, pathMain, pathReserve, symbol
  var bgLayers = [];
  var bgNextId = 1;
  var bgActiveId = null;
  var objects = [];
  var paths = { main: [], reserve: [] };
  var symbols = [];
  var labels = [];
  var selectedObj = null;
  var isDragging = false;
  var dragStartX = 0, dragStartY = 0;

  // Временное состояние для рисования
  var isDrawing = false;
  var drawStart = null;
  var currentPath = [];
  var currentPolyPoints = []; // для полилиний (стены/перегородки)
  var drawColor = '#374151';
  var drawWidth = 2;

  // Магнит
  var SNAP_DIST = 12;

  // Shift
  var shiftHeld = false;

  // Диалог надписи
  var textDialogCb = null;
  var labelDialogPos = null;

  function closeDrawMenu() {
    var m = document.getElementById('drawMenu');
    if (m) m.classList.remove('show');
  }

  // Диалог надписи
  function readDialogLabelCfg() {
    return {
      text: document.getElementById('tdText').value,
      size: parseInt(document.getElementById('tdSize').value, 10) || 14,
      bold: document.getElementById('tdBold').checked,
      italic: document.getElementById('tdItalic').checked,
      font: document.getElementById('tdFont').value || 'sans-serif',
      color: document.getElementById('tdColor').value,
      bgColor: document.getElementById('tdNoBg').checked ? null : document.getElementById('tdBg').value
    };
  }

  function openTextDialog(title, initial, cb) {
    textDialogCb = cb;
    document.getElementById('textDialogTitle').textContent = title;
    document.getElementById('tdText').value = (initial && initial.text) || '';
    document.getElementById('tdSize').value = (initial && initial.size) || 14;
    document.getElementById('tdBold').checked = !!(initial && initial.bold);
    document.getElementById('tdItalic').checked = !!(initial && initial.italic);
    document.getElementById('tdFont').value = (initial && initial.font) || 'sans-serif';
    document.getElementById('tdColor').value = (initial && initial.color) || '#000000';
    var hasBg = !!(initial && initial.bgColor);
    document.getElementById('tdBg').value = hasBg ? initial.bgColor : '#ffffff';
    document.getElementById('tdNoBg').checked = !hasBg;
    document.getElementById('textDialog').hidden = false;
    document.getElementById('tdText').focus();
  }

  function closeTextDialog() {
    document.getElementById('textDialog').hidden = true;
    textDialogCb = null;
    labelDialogPos = null;
  }

  function applyTextDialog() {
    if (!textDialogCb) return;
    var cfg = readDialogLabelCfg();
    if (!cfg.text.trim()) return;
    var cb = textDialogCb;
    closeTextDialog();
    cb(cfg);
  }

  function initTextDialog() {
    document.getElementById('tdOk').addEventListener('click', applyTextDialog);
    document.getElementById('tdCancel').addEventListener('click', closeTextDialog);
    document.getElementById('tdText').addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) applyTextDialog();
    });
  }

  // Ограничение угла до ближайшего 90° при зажатом Shift
  function constrainAngle(from, to) {
    if (!shiftHeld) return to;
    var dx = to.x - from.x, dy = to.y - from.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return to;
    var angle = Math.atan2(dy, dx);
    var snapped = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
    return { x: from.x + Math.cos(snapped) * len, y: from.y + Math.sin(snapped) * len };
  }

  // Магнит к концам стен/перегородок
  function snapPoint(wx, wy) {
    var best = null, bestDist = SNAP_DIST / zoom;
    for (var i = 0; i < objects.length; i++) {
      var o = objects[i];
      if (o.type !== 'wall' && o.type !== 'partition') continue;
      if (!o.points || o.points.length < 2) continue;
      for (var j = 0; j < o.points.length; j++) {
        var p = o.points[j];
        var dx = wx - p.x, dy = wy - p.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestDist) { bestDist = d; best = { x: p.x, y: p.y }; }
      }
    }
    return best || { x: wx, y: wy };
  }

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDblClick);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    initTextDialog();
    requestAnimationFrame(render);
  }

  function resize() {
    var wrap = canvas.parentElement;
    DPR = window.devicePixelRatio || 1;
    W = wrap.clientWidth;
    H = wrap.clientHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    render();
  }

  // ========== Координаты ==========
  function screenToWorld(sx, sy) {
    return { x: (sx - panX) / zoom, y: (sy - panY) / zoom };
  }

  // ========== Отрисовка ==========
  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // Подложки
    for (var i = 0; i < bgLayers.length; i++) {
      var L = bgLayers[i];
      if (!L.visible || !L.img) continue;
      ctx.globalAlpha = L.opacity;
      ctx.drawImage(L.img, L.x, L.y, L.w, L.h);
      ctx.globalAlpha = 1;
      if (L.id === bgActiveId) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        ctx.strokeRect(L.x, L.y, L.w, L.h);
        ctx.setLineDash([]);
      }
    }

    // Стены
    for (var i = 0; i < objects.length; i++) {
      drawObject(objects[i]);
    }

    // Пути эвакуации
    drawPaths(paths.main, '#16a34a', false);
    drawPaths(paths.reserve, '#d97706', true);

    // Рисуемый путь (предпросмотр)
    if (isDrawing && currentPath.length > 0 && (tool === 'pathMain' || tool === 'pathReserve')) {
      var col = tool === 'pathMain' ? '#16a34a' : '#d97706';
      ctx.strokeStyle = col;
      ctx.lineWidth = 4 / zoom;
      if (tool === 'pathReserve') ctx.setLineDash([8 / zoom, 4 / zoom]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      for (var i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i].x, currentPath[i].y);
      }
      var cur = screenToWorld(lastMouseX, lastMouseY);
      ctx.lineTo(cur.x, cur.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // Точки вершин
      for (var i = 0; i < currentPath.length; i++) {
        ctx.beginPath();
        ctx.arc(currentPath[i].x, currentPath[i].y, 4 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
      }
    }

    // Рисуемый объект (предпросмотр линии)
    if (isDrawing && drawStart && tool === 'line') {
      var cur = screenToWorld(lastMouseX, lastMouseY);
      var constrained = constrainAngle(drawStart, cur);
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = drawWidth / zoom;
      ctx.lineCap = 'round';
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.beginPath();
      ctx.moveTo(drawStart.x, drawStart.y);
      ctx.lineTo(constrained.x, constrained.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Рисуемая полилиния (стена/перегородка)
    if (isDrawing && currentPolyPoints.length > 0 && (tool === 'wall' || tool === 'partition')) {
      var thick = tool === 'wall' ? 10 : 5;
      var col = tool === 'wall' ? '#374151' : '#6b7280';
      ctx.strokeStyle = col;
      ctx.lineWidth = thick / zoom;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(currentPolyPoints[0].x, currentPolyPoints[0].y);
      for (var i = 1; i < currentPolyPoints.length; i++) {
        ctx.lineTo(currentPolyPoints[i].x, currentPolyPoints[i].y);
      }
      var cur = screenToWorld(lastMouseX, lastMouseY);
      var snapped = snapPoint(cur.x, cur.y);
      var lastPt = currentPolyPoints[currentPolyPoints.length - 1];
      var constrained = constrainAngle(lastPt, snapped);
      ctx.lineTo(constrained.x, constrained.y);
      ctx.stroke();
      // Точки вершин
      for (var i = 0; i < currentPolyPoints.length; i++) {
        ctx.beginPath();
        ctx.arc(currentPolyPoints[i].x, currentPolyPoints[i].y, 4 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
      }
    }

    // Символы
    for (var i = 0; i < symbols.length; i++) {
      FireSymbols.draw(ctx, symbols[i].type, symbols[i].x, symbols[i].y, symbols[i].scale || 1);
    }

    // Надписи
    for (var i = 0; i < labels.length; i++) {
      var lb = labels[i];
      ctx.save();
      var px = lb.size;
      ctx.font = (lb.bold ? 'bold ' : '') + (lb.italic ? 'italic ' : '') + px + 'px ' + (lb.font || 'sans-serif');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      var lines = String(lb.text).split('\n');
      var tw = 0;
      for (var k = 0; k < lines.length; k++) {
        var w2 = ctx.measureText(lines[k]).width;
        if (w2 > tw) tw = w2;
      }
      var pad = 4, lh = Math.ceil(px * 1.35);
      var bw = tw + pad * 2, bh = lh * lines.length + pad * 2;
      if (lb.bgColor) {
        ctx.fillStyle = lb.bgColor;
        ctx.fillRect(lb.x, lb.y, bw, bh);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(lb.x, lb.y, bw, bh);
      }
      ctx.fillStyle = lb.color || '#000000';
      for (var k = 0; k < lines.length; k++) {
        ctx.fillText(lines[k], lb.x + pad, lb.y + pad + k * lh);
      }
      ctx.restore();
    }

    ctx.restore();
  }

  function drawObject(obj) {
    ctx.save();
    if (obj.type === 'wall' || obj.type === 'partition') {
      if (obj.points && obj.points.length > 1) {
        ctx.strokeStyle = obj.color || '#374151';
        ctx.lineWidth = (obj.thickness || 10) / zoom;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(obj.points[0].x, obj.points[0].y);
        for (var i = 1; i < obj.points.length; i++) {
          ctx.lineTo(obj.points[i].x, obj.points[i].y);
        }
        ctx.stroke();
      }
    } else if (obj.type === 'line') {
      ctx.strokeStyle = obj.color || '#374151';
      ctx.lineWidth = (obj.width || 2) / zoom;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(obj.x, obj.y);
      ctx.lineTo(obj.x + obj.w, obj.y + obj.h);
      ctx.stroke();
    }
    if (selectedObj === obj) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3 / zoom;
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      if (obj.type === 'wall' || obj.type === 'partition') {
        if (obj.points && obj.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(obj.points[0].x, obj.points[0].y);
          for (var i = 1; i < obj.points.length; i++) {
            ctx.lineTo(obj.points[i].x, obj.points[i].y);
          }
          ctx.stroke();
        }
      } else if (obj.type === 'line') {
        var len = Math.sqrt(obj.w * obj.w + obj.h * obj.h);
        if (len > 0) {
          var nx = -obj.h / len * 4, ny = obj.w / len * 4;
          ctx.beginPath();
          ctx.moveTo(obj.x + nx, obj.y + ny);
          ctx.lineTo(obj.x + obj.w + nx, obj.y + obj.h + ny);
          ctx.lineTo(obj.x + obj.w - nx, obj.y + obj.h - ny);
          ctx.lineTo(obj.x - nx, obj.y - ny);
          ctx.closePath();
          ctx.stroke();
        }
      } else {
        ctx.strokeRect(obj.x - 2, obj.y - 2, obj.w + 4, obj.h + 4);
      }
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // ========== Отрисовка путей с умными стрелками ==========
  function drawPaths(pathArray, color, dashed) {
    for (var i = 0; i < pathArray.length; i++) {
      var p = pathArray[i];
      if (p.points.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      if (dashed) ctx.setLineDash([8, 4]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(p.points[0].x, p.points[0].y);
      for (var j = 1; j < p.points.length; j++) {
        ctx.lineTo(p.points[j].x, p.points[j].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // Умные стрелки
      drawSmartArrows(p.points, color);
      ctx.restore();
    }
  }

  function drawSmartArrows(points, color) {
    if (points.length < 2) return;
    var arrowLen = 14;
    var arrowWidth = 6;
    var minDist = 40; // минимальное расстояние между стрелками

    // Собираем все позиции стрелок
    var arrowPlacements = [];

    for (var j = 0; j < points.length - 1; j++) {
      var p1 = points[j];
      var p2 = points[j + 1];
      var dx = p2.x - p1.x;
      var dy = p2.y - p1.y;
      var segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen < 1) continue;
      var angle = Math.atan2(dy, dx);

      // Проверяем, есть ли поворот на p2 (следующей вершине)
      var nextAngle = null;
      if (j + 2 < points.length) {
        var p3 = points[j + 2];
        var dx2 = p3.x - p2.x, dy2 = p3.y - p2.y;
        nextAngle = Math.atan2(dy2, dx2);
      }

      // Определяем, куда ставить стрелку
      if (nextAngle !== null) {
        // Есть поворот — стрелка по центру предыдущего (этого) сегмента
        arrowPlacements.push({
          x: p1.x + dx * 0.5, y: p1.y + dy * 0.5, angle: angle
        });
      } else if (j === points.length - 2) {
        // Последний сегмент — острый треугольник в конце
        arrowPlacements.push({
          x: p2.x - dx / segLen * 2, y: p2.y - dy / segLen * 2, angle: angle, sharp: true
        });
      } else if (segLen > 120) {
        // Длинный сегмент без поворота — стрелка в центре
        arrowPlacements.push({
          x: p1.x + dx * 0.5, y: p1.y + dy * 0.5, angle: angle
        });
      }
    }

    // Убираем стрелки, которые стоят слишком близко друг к другу
    var filtered = [];
    for (var i = 0; i < arrowPlacements.length; i++) {
      var a = arrowPlacements[i];
      var tooClose = false;
      for (var k = 0; k < filtered.length; k++) {
        var dx = a.x - filtered[k].x, dy = a.y - filtered[k].y;
        if (Math.sqrt(dx * dx + dy * dy) < minDist) { tooClose = true; break; }
      }
      if (!tooClose) filtered.push(a);
    }

    // Рисуем
    for (var i = 0; i < filtered.length; i++) {
      var a = filtered[i];
      if (a.sharp) {
        drawSharpArrow(ctx, a.x, a.y, a.angle, color, arrowLen, arrowWidth);
      } else {
        drawMidArrow(ctx, a.x, a.y, a.angle, color, arrowLen, arrowWidth);
      }
    }
  }

  // Острый треугольник в конце пути
  function drawSharpArrow(ctx2, x, y, angle, color, len, w) {
    ctx2.save();
    ctx2.translate(x, y);
    ctx2.rotate(angle);
    ctx2.beginPath();
    ctx2.moveTo(len, 0);
    ctx2.lineTo(-2, -w);
    ctx2.lineTo(-2, w);
    ctx2.closePath();
    ctx2.fillStyle = color;
    ctx2.fill();
    ctx2.restore();
  }

  // Стрелка в центре сегмента (наконечник)
  function drawMidArrow(ctx2, x, y, angle, color, len, w) {
    ctx2.save();
    ctx2.translate(x, y);
    ctx2.rotate(angle);
    var half = len * 0.4;
    ctx2.beginPath();
    ctx2.moveTo(half, 0);
    ctx2.lineTo(-half, -w);
    ctx2.lineTo(-half, 0);
    ctx2.lineTo(-half, w);
    ctx2.closePath();
    ctx2.fillStyle = color;
    ctx2.fill();
    ctx2.restore();
  }

  // ========== Клавиатура ==========
  function onKeyDown(e) {
    if (e.key === 'Shift') {
      shiftHeld = true;
      var hint = document.getElementById('shiftHint');
      if (hint && (tool === 'wall' || tool === 'partition' || tool === 'line')) {
        hint.style.display = 'block';
      }
    }
    if (e.key === 'Escape') {
      finishPath();
      finishPolyline();
    }
    if (e.key === 'Enter') {
      if (isDrawing && (tool === 'pathMain' || tool === 'pathReserve')) finishPath();
      if (isDrawing && (tool === 'wall' || tool === 'partition')) finishPolyline();
    }
    if (e.key === 'Delete' && selectedObj) {
      var idx = objects.indexOf(selectedObj);
      if (idx >= 0) { objects.splice(idx, 1); selectedObj = null; }
      var idx2 = symbols.indexOf(selectedObj);
      if (idx2 >= 0) { symbols.splice(idx2, 1); selectedObj = null; }
      render();
    }
  }

  function onKeyUp(e) {
    if (e.key === 'Shift') {
      shiftHeld = false;
      var hint = document.getElementById('shiftHint');
      if (hint) hint.style.display = 'none';
    }
  }

  function finishPath() {
    if (isDrawing && currentPath.length > 1) {
      var target = tool === 'pathMain' ? paths.main : paths.reserve;
      target.push({ points: currentPath.slice() });
    }
    isDrawing = false;
    currentPath = [];
    drawStart = null;
    render();
  }

  function finishPolyline() {
    if (isDrawing && currentPolyPoints.length > 1) {
      var thick = tool === 'wall' ? 10 : 5;
      var col = tool === 'wall' ? '#374151' : '#6b7280';
      var obj = {
        id: Date.now().toString(36),
        type: tool,
        points: currentPolyPoints.slice(),
        thickness: thick,
        color: col
      };
      // Объединение с другими стенами/перегородками при пересечении
      mergeWalls(obj);
      objects.push(obj);
    }
    isDrawing = false;
    currentPolyPoints = [];
    drawStart = null;
    render();
  }

  // Объединение стен при пересечении: добавляем общие точки
  function mergeWalls(newObj) {
    for (var i = 0; i < objects.length; i++) {
      var o = objects[i];
      if (o.type !== 'wall' && o.type !== 'partition') continue;
      if (!o.points || o.points.length < 2) continue;
      // Проверяем каждый сегмент новой стены на пересечение с каждым сегментом существующей
      for (var a = 0; a < newObj.points.length - 1; a++) {
        for (var b = 0; b < o.points.length - 1; b++) {
          var inter = segmentIntersection(
            newObj.points[a], newObj.points[a + 1],
            o.points[b], o.points[b + 1]
          );
          if (inter) {
            // Вставляем точку пересечения в обе полилинии
            insertPoint(newObj.points, a, inter);
            a++;
            insertPoint(o.points, b, inter);
            b++;
          }
        }
      }
    }
  }

  function insertPoint(points, segIdx, pt) {
    var d1 = dist(points[segIdx], pt);
    var d2 = dist(points[segIdx + 1], pt);
    if (d1 > 2 && d2 > 2) {
      points.splice(segIdx + 1, 0, pt);
    }
  }

  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function segmentIntersection(p1, p2, p3, p4) {
    var d1x = p2.x - p1.x, d1y = p2.y - p1.y;
    var d2x = p4.x - p3.x, d2y = p4.y - p3.y;
    var cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 0.001) return null;
    var t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / cross;
    var u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / cross;
    if (t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99) {
      return { x: p1.x + d1x * t, y: p1.y + d1y * t };
    }
    return null;
  }

  // ========== Мышь ==========
  var lastMouseX = 0, lastMouseY = 0;
  var isPanning = false;
  var panStartX = 0, panStartY = 0;

  function onMouseDown(e) {
    var rect = canvas.getBoundingClientRect();
    var sx = e.clientX - rect.left;
    var sy = e.clientY - rect.top;
    var w = screenToWorld(sx, sy);

    if (e.button === 1 || e.button === 2 || e.altKey) {
      isPanning = true;
      panStartX = sx - panX;
      panStartY = sy - panY;
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    // Рисование — передаём управление ниже
    var isDrawTool = (tool === 'wall' || tool === 'partition' || tool === 'line' ||
      tool === 'pathMain' || tool === 'pathReserve' || tool === 'label' || tool === 'symbol');

    // По умолчанию — перетаскивание надписей и символов (только если не инструмент рисования)
    if (!isDrawTool && tool !== 'editor') {
      var hit = hitTestAll(w.x, w.y);
      if (hit && (hit._isLabel || symbols.indexOf(hit) >= 0)) {
        isDragging = true;
        if (hit._isLabel) {
          dragStartX = w.x - labels[hit._labelIndex].x;
          dragStartY = w.y - labels[hit._labelIndex].y;
        } else {
          dragStartX = w.x - hit.x;
          dragStartY = w.y - hit.y;
        }
        selectedObj = hit;
        render();
        return;
      }
      return;
    }

    // Режим «Редактор» — выделение/перемещение/удаление любых объектов
    if (tool === 'editor') {
      selectedObj = hitTestAll(w.x, w.y);
      if (selectedObj) {
        isDragging = true;
        if (selectedObj._isLabel) {
          dragStartX = w.x - labels[selectedObj._labelIndex].x;
          dragStartY = w.y - labels[selectedObj._labelIndex].y;
        } else {
          dragStartX = w.x - (selectedObj.x || 0);
          dragStartY = w.y - (selectedObj.y || 0);
        }
      }
      render();
      return;
    }

    if (tool === 'wall' || tool === 'partition') {
      var cur = screenToWorld(lastMouseX, lastMouseY);
      var snapped = snapPoint(cur.x, cur.y);
      closeDrawMenu();
      if (!isDrawing) {
        isDrawing = true;
        currentPolyPoints = [{ x: snapped.x, y: snapped.y }];
      } else {
        var lastPt = currentPolyPoints[currentPolyPoints.length - 1];
        var constrained = constrainAngle(lastPt, snapped);
        currentPolyPoints.push(constrained);
      }
      render();
      return;
    }

    if (tool === 'line') {
      closeDrawMenu();
      isDrawing = true;
      drawStart = { x: w.x, y: w.y };
      return;
    }

    if (tool === 'pathMain' || tool === 'pathReserve') {
      closeDrawMenu();
      if (!isDrawing) {
        isDrawing = true;
        currentPath = [{ x: w.x, y: w.y }];
      } else {
        currentPath.push({ x: w.x, y: w.y });
      }
      render();
      return;
    }

    if (tool === 'symbol') {
      closeDrawMenu();
      if (window._selectedSymbolType) {
        symbols.push({
          id: Date.now().toString(36),
          type: window._selectedSymbolType,
          x: w.x, y: w.y, scale: 1
        });
        render();
      }
      return;
    }

    if (tool === 'label') {
      closeDrawMenu();
      labelDialogPos = { x: w.x, y: w.y };
      openTextDialog('Новая надпись', {
        text: '', size: 14, bold: false, italic: false,
        font: 'sans-serif', color: '#000000', bgColor: null
      }, function(cfg) {
        labels.push({
          id: Date.now().toString(36),
          x: labelDialogPos.x, y: labelDialogPos.y,
          text: cfg.text, size: cfg.size, bold: cfg.bold,
          italic: cfg.italic, font: cfg.font, color: cfg.color,
          bgColor: cfg.bgColor
        });
        labelDialogPos = null;
        render();
      });
      return;
    }
  }

  function onMouseMove(e) {
    var rect = canvas.getBoundingClientRect();
    var sx = e.clientX - rect.left;
    var sy = e.clientY - rect.top;
    lastMouseX = sx;
    lastMouseY = sy;

    if (isPanning) {
      panX = sx - panStartX;
      panY = sy - panStartY;
      render();
      return;
    }

    if (isDragging && selectedObj) {
      var w = screenToWorld(sx, sy);
      if (selectedObj._isLabel) {
        labels[selectedObj._labelIndex].x = w.x - dragStartX;
        labels[selectedObj._labelIndex].y = w.y - dragStartY;
      } else if (symbols.indexOf(selectedObj) >= 0) {
        selectedObj.x = w.x - dragStartX;
        selectedObj.y = w.y - dragStartY;
      } else if (tool === 'editor') {
        selectedObj.x = w.x - dragStartX;
        selectedObj.y = w.y - dragStartY;
      }
      render();
      return;
    }

    if (isDrawing) {
      render();
    }

    var w = screenToWorld(sx, sy);
    document.getElementById('cursorPos').textContent = 'X: ' + w.x.toFixed(0) + ', Y: ' + w.y.toFixed(0);
  }

  function onMouseUp(e) {
    if (isPanning) {
      isPanning = false;
      canvas.style.cursor = 'crosshair';
      return;
    }
    if (isDragging) {
      isDragging = false;
      return;
    }
    if (isDrawing && tool === 'line') {
      var rect = canvas.getBoundingClientRect();
      var sx = e.clientX - rect.left;
      var sy = e.clientY - rect.top;
      var end = screenToWorld(sx, sy);
      var constrained = constrainAngle(drawStart, end);
      var dx = constrained.x - drawStart.x;
      var dy = constrained.y - drawStart.y;
      if (Math.sqrt(dx * dx + dy * dy) > 3) {
        objects.push({
          id: Date.now().toString(36), type: 'line',
          x: drawStart.x, y: drawStart.y, w: dx, h: dy,
          color: drawColor, width: drawWidth
        });
      }
      isDrawing = false;
      drawStart = null;
      render();
      return;
    }
  }

  function onWheel(e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var sx = e.clientX - rect.left;
    var sy = e.clientY - rect.top;
    var delta = e.deltaY > 0 ? 0.9 : 1.1;
    var newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * delta));
    panX = sx - (sx - panX) * (newZoom / zoom);
    panY = sy - (sy - panY) * (newZoom / zoom);
    zoom = newZoom;
    document.getElementById('scaleDisplay').textContent = 'Масштаб: ' + (zoom * 100).toFixed(0) + '%';
    render();
  }

  function onDblClick(e) {
    var rect = canvas.getBoundingClientRect();
    var sx = e.clientX - rect.left;
    var sy = e.clientY - rect.top;
    var w = screenToWorld(sx, sy);

    // Завершение рисования
    if (isDrawing && (tool === 'pathMain' || tool === 'pathReserve')) {
      finishPath();
      return;
    }
    if (isDrawing && (tool === 'wall' || tool === 'partition')) {
      finishPolyline();
      return;
    }

    var hit = hitTestAll(w.x, w.y);

    // Двойной клик по надписи — редактирование (всегда)
    if (hit && hit._isLabel) {
      var lb = labels[hit._labelIndex];
      labelDialogPos = { x: lb.x, y: lb.y };
      openTextDialog('Редактировать надпись', lb, function(cfg) {
        lb.text = cfg.text;
        lb.size = cfg.size;
        lb.bold = cfg.bold;
        lb.italic = cfg.italic;
        lb.font = cfg.font;
        lb.color = cfg.color;
        lb.bgColor = cfg.bgColor;
        labelDialogPos = null;
        render();
      });
      return;
    }

    // Двойной клик по объекту — удаление (в режиме редактора)
    if (tool === 'editor' && hit && !hit._isLabel) {
      if (confirm('Удалить объект?')) {
        var idx = objects.indexOf(hit);
        if (idx >= 0) objects.splice(idx, 1);
        var idx2 = symbols.indexOf(hit);
        if (idx2 >= 0) symbols.splice(idx2, 1);
        selectedObj = null;
        render();
      }
    }
  }

  function hitTestAll(wx, wy) {
    for (var i = objects.length - 1; i >= 0; i--) {
      var o = objects[i];
      if (o.type === 'wall' || o.type === 'partition') {
        if (!o.points || o.points.length < 2) continue;
        var halfThick = (o.thickness || 10) / 2;
        for (var j = 0; j < o.points.length - 1; j++) {
          var a = o.points[j], b = o.points[j + 1];
          var dx = b.x - a.x, dy = b.y - a.y;
          var len2 = dx * dx + dy * dy;
          if (len2 < 1) continue;
          var t = Math.max(0, Math.min(1, ((wx - a.x) * dx + (wy - a.y) * dy) / len2));
          var px = a.x + t * dx, py = a.y + t * dy;
          var dist2 = (wx - px) * (wx - px) + (wy - py) * (wy - py);
          if (dist2 < (halfThick + 4) * (halfThick + 4)) return o;
        }
      } else if (o.type === 'line') {
        var dx = o.w, dy = o.h;
        var len2 = dx * dx + dy * dy;
        if (len2 < 1) continue;
        var t = Math.max(0, Math.min(1, ((wx - o.x) * dx + (wy - o.y) * dy) / len2));
        var px = o.x + t * dx, py = o.y + t * dy;
        var dist2 = (wx - px) * (wx - px) + (wy - py) * (wy - py);
        if (dist2 < 100) return o;
      } else {
        if (wx >= o.x && wx <= o.x + o.w && wy >= o.y && wy <= o.y + o.h) return o;
      }
    }
    // Надписи
    for (var i = labels.length - 1; i >= 0; i--) {
      var lb = labels[i];
      var px = lb.size;
      ctx.font = (lb.bold ? 'bold ' : '') + (lb.italic ? 'italic ' : '') + px + 'px ' + (lb.font || 'sans-serif');
      var lines = String(lb.text).split('\n');
      var tw = 0;
      for (var k = 0; k < lines.length; k++) {
        var w2 = ctx.measureText(lines[k]).width;
        if (w2 > tw) tw = w2;
      }
      var pad = 4, lh = Math.ceil(px * 1.35);
      var bw = tw + pad * 2, bh = lh * lines.length + pad * 2;
      if (wx >= lb.x && wx <= lb.x + bw && wy >= lb.y && wy <= lb.y + bh) {
        return { _isLabel: true, _labelIndex: i, x: lb.x, y: lb.y };
      }
    }
    for (var i = symbols.length - 1; i >= 0; i--) {
      if (FireSymbols.hitTest(symbols[i], wx, wy)) return symbols[i];
    }
    return null;
  }

  // ========== Подложка ==========
  function addBgImage(img, name) {
    var L = {
      id: 'bg' + (bgNextId++), img: img, name: name || ('Подложка ' + bgNextId),
      opacity: 1, visible: true, x: 0, y: 0, w: 0, h: 0
    };
    var s = Math.min(W / img.width, H / img.height) * 0.8;
    L.w = img.width * s;
    L.h = img.height * s;
    L.x = (W / zoom - L.w) / 2 - panX / zoom;
    L.y = (H / zoom - L.h) / 2 - panY / zoom;
    bgLayers.push(L);
    bgActiveId = L.id;
    render();
    return L;
  }

  function removeBgLayer(id) {
    bgLayers = bgLayers.filter(function(l) { return l.id !== id; });
    if (bgActiveId === id) bgActiveId = bgLayers.length ? bgLayers[bgLayers.length - 1].id : null;
    render();
  }

  function fitToAll() {
    if (bgLayers.length === 0) { zoom = 1; panX = 0; panY = 0; return; }
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < bgLayers.length; i++) {
      var L = bgLayers[i];
      minX = Math.min(minX, L.x); minY = Math.min(minY, L.y);
      maxX = Math.max(maxX, L.x + L.w); maxY = Math.max(maxY, L.y + L.h);
    }
    var bw = maxX - minX, bh = maxY - minY;
    zoom = Math.min(W / bw, H / bh) * 0.9;
    panX = (W - bw * zoom) / 2 - minX * zoom;
    panY = (H - bh * zoom) / 2 - minY * zoom;
    document.getElementById('scaleDisplay').textContent = 'Масштаб: ' + (zoom * 100).toFixed(0) + '%';
    render();
  }

  // ========== Инструменты ==========
  function setTool(t) {
    // Завершаем предыдущий путь/полилинию если были
    if (isDrawing && (tool === 'pathMain' || tool === 'pathReserve') && t !== tool) {
      finishPath();
    }
    if (isDrawing && (tool === 'wall' || tool === 'partition') && t !== tool) {
      finishPolyline();
    }
    tool = t;
    isDrawing = false;
    currentPath = [];
    currentPolyPoints = [];
    drawStart = null;
    // Обновляем активную кнопку
    document.querySelectorAll('#toolbar .tb-btn').forEach(function(btn) { btn.classList.remove('active'); });
    var btnMap = {
      select: 'btnEditor', editor: 'btnEditor', wall: 'btnDraw', partition: 'btnDraw', line: 'btnDraw', label: 'btnLabel',
      pathMain: 'btnPathMain', pathReserve: 'btnPathReserve', symbol: 'btnSymbol'
    };
    var btn = document.getElementById(btnMap[t]);
    if (btn) btn.classList.add('active');
    // Обновляем активный пункт в выпадающем меню
    document.querySelectorAll('#drawMenu .tb-dd-item').forEach(function(item) {
      item.classList.toggle('active', item.dataset.draw === t);
    });
    // Подсказка Shift
    var hint = document.getElementById('shiftHint');
    if (hint) hint.style.display = 'none';
    render();
  }

  function setDrawColor(c) { drawColor = c; }
  function setDrawWidth(w) { drawWidth = w; }

  function clearAll() {
    if (!confirm('Очистить весь план?')) return;
    objects = [];
    paths = { main: [], reserve: [] };
    symbols = [];
    labels = [];
    selectedObj = null;
    render();
  }

  // ========== Данные ==========
  function getData() {
    return {
      bgLayers: bgLayers.map(function(l) {
        return { id: l.id, name: l.name, opacity: l.opacity, visible: l.visible, x: l.x, y: l.y, w: l.w, h: l.h, dataUrl: l.dataUrl || null };
      }),
      objects: objects.map(function(o) {
        if (o.type === 'wall' || o.type === 'partition') {
          return { id: o.id, type: o.type, points: o.points, thickness: o.thickness, color: o.color };
        }
        return o;
      }),
      paths: paths, symbols: symbols,
      labels: labels
    };
  }

  function setData(data) {
    if (!data) return;
    objects = (data.objects || []).map(function(o) {
      if (o.type === 'wall' || o.type === 'partition') {
        return { id: o.id, type: o.type, points: o.points || [], thickness: o.thickness || (o.type === 'wall' ? 10 : 5), color: o.color || (o.type === 'wall' ? '#374151' : '#6b7280') };
      }
      return o;
    });
    paths = data.paths || { main: [], reserve: [] };
    symbols = data.symbols || [];
    labels = data.labels || [];
    render();
  }

  // ========== Экспорт полного изображения ==========
  function getFullImageDataURL() {
    // Вычисляем границы всех объектов и подложек
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < bgLayers.length; i++) {
      var L = bgLayers[i];
      minX = Math.min(minX, L.x); minY = Math.min(minY, L.y);
      maxX = Math.max(maxX, L.x + L.w); maxY = Math.max(maxY, L.y + L.h);
    }
    for (var i = 0; i < objects.length; i++) {
      var o = objects[i];
      if (o.type === 'wall' || o.type === 'partition') {
        if (o.points) {
          for (var j = 0; j < o.points.length; j++) {
            minX = Math.min(minX, o.points[j].x); minY = Math.min(minY, o.points[j].y);
            maxX = Math.max(maxX, o.points[j].x); maxY = Math.max(maxY, o.points[j].y);
          }
        }
      } else {
        minX = Math.min(minX, o.x); minY = Math.min(minY, o.y);
        maxX = Math.max(maxX, o.x + o.w); maxY = Math.max(maxY, o.y + o.h);
      }
    }
    for (var i = 0; i < symbols.length; i++) {
      minX = Math.min(minX, symbols[i].x - 30); minY = Math.min(minY, symbols[i].y - 30);
      maxX = Math.max(maxX, symbols[i].x + 30); maxY = Math.max(maxY, symbols[i].y + 30);
    }
    for (var i = 0; i < labels.length; i++) {
      var lb = labels[i];
      var px = lb.size;
      var lines = String(lb.text).split('\n');
      var tw = px * Math.max.apply(null, lines.map(function(l) { return l.length; })) * 0.6;
      var th = px * 1.35 * lines.length;
      minX = Math.min(minX, lb.x - 10); minY = Math.min(minY, lb.y - 10);
      maxX = Math.max(maxX, lb.x + tw + 20); maxY = Math.max(maxY, lb.y + th + 20);
    }
    // Добавляем отступы
    var pad = 40;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    var w = maxX - minX;
    var h = maxY - minY;
    if (w < 100 || h < 100) return null;
    // Создаём offscreen canvas
    var off = document.createElement('canvas');
    off.width = w * 2;
    off.height = h * 2;
    var octx = off.getContext('2d');
    octx.setTransform(2, 0, 0, 2, 0, 0);
    octx.translate(-minX, -minY);
    // Подложки
    for (var i = 0; i < bgLayers.length; i++) {
      var L = bgLayers[i];
      if (!L.visible || !L.img) continue;
      octx.globalAlpha = L.opacity;
      octx.drawImage(L.img, L.x, L.y, L.w, L.h);
      octx.globalAlpha = 1;
    }
    // Объекты (стены, перегородки, окна, двери, линии)
    for (var i = 0; i < objects.length; i++) {
      var o = objects[i];
      if (o.type === 'wall' || o.type === 'partition') {
        if (o.points && o.points.length > 1) {
          octx.strokeStyle = o.color || '#374151';
          octx.lineWidth = o.thickness || 10;
          octx.lineCap = 'round';
          octx.lineJoin = 'round';
          octx.beginPath();
          octx.moveTo(o.points[0].x, o.points[0].y);
          for (var j = 1; j < o.points.length; j++) {
            octx.lineTo(o.points[j].x, o.points[j].y);
          }
          octx.stroke();
        }
      } else if (o.type === 'line') {
        octx.strokeStyle = o.color || '#374151';
        octx.lineWidth = o.width || 2;
        octx.lineCap = 'round';
        octx.beginPath();
        octx.moveTo(o.x, o.y);
        octx.lineTo(o.x + o.w, o.y + o.h);
        octx.stroke();
      }
    }
    // Пути (дублируем логику drawPaths)
    renderPaths(octx, paths.main, '#16a34a', false);
    renderPaths(octx, paths.reserve, '#d97706', true);
    // Символы
    for (var i = 0; i < symbols.length; i++) {
      FireSymbols.draw(octx, symbols[i].type, symbols[i].x, symbols[i].y, symbols[i].scale || 1);
    }
    // Надписи
    for (var i = 0; i < labels.length; i++) {
      var lb = labels[i];
      var px = lb.size;
      octx.font = (lb.bold ? 'bold ' : '') + (lb.italic ? 'italic ' : '') + px + 'px ' + (lb.font || 'sans-serif');
      octx.textAlign = 'left';
      octx.textBaseline = 'top';
      var lines = String(lb.text).split('\n');
      var tw = 0;
      for (var k = 0; k < lines.length; k++) {
        var w2 = octx.measureText(lines[k]).width;
        if (w2 > tw) tw = w2;
      }
      var pad = 4, lh = Math.ceil(px * 1.35);
      var bw = tw + pad * 2, bh = lh * lines.length + pad * 2;
      if (lb.bgColor) {
        octx.fillStyle = lb.bgColor;
        octx.fillRect(lb.x, lb.y, bw, bh);
        octx.strokeStyle = 'rgba(0,0,0,0.25)';
        octx.lineWidth = 1;
        octx.strokeRect(lb.x, lb.y, bw, bh);
      }
      octx.fillStyle = lb.color || '#000000';
      for (var k = 0; k < lines.length; k++) {
        octx.fillText(lines[k], lb.x + pad, lb.y + pad + k * lh);
      }
    }
    return off.toDataURL('image/png');
  }

  function renderPaths(ctx2, pathArray, color, dashed) {
    for (var i = 0; i < pathArray.length; i++) {
      var p = pathArray[i];
      if (p.points.length < 2) continue;
      ctx2.save();
      ctx2.strokeStyle = color;
      ctx2.lineWidth = 4;
      if (dashed) ctx2.setLineDash([8, 4]);
      ctx2.lineCap = 'round';
      ctx2.lineJoin = 'round';
      ctx2.beginPath();
      ctx2.moveTo(p.points[0].x, p.points[0].y);
      for (var j = 1; j < p.points.length; j++) {
        ctx2.lineTo(p.points[j].x, p.points[j].y);
      }
      ctx2.stroke();
      ctx2.setLineDash([]);
      drawSmartArrowsOnCtx(ctx2, p.points, color);
      ctx2.restore();
    }
  }

  function drawSmartArrowsOnCtx(ctx2, points, color) {
    if (points.length < 2) return;
    var arrowLen = 14;
    var arrowWidth = 6;
    var minDist = 40;
    var arrowPlacements = [];
    for (var j = 0; j < points.length - 1; j++) {
      var p1 = points[j], p2 = points[j + 1];
      var dx = p2.x - p1.x, dy = p2.y - p1.y;
      var segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen < 1) continue;
      var angle = Math.atan2(dy, dx);
      var nextAngle = null;
      if (j + 2 < points.length) {
        var p3 = points[j + 2];
        nextAngle = Math.atan2(p3.y - p2.y, p3.x - p2.x);
      }
      if (nextAngle !== null) {
        arrowPlacements.push({ x: p1.x + dx * 0.5, y: p1.y + dy * 0.5, angle: angle });
      } else if (j === points.length - 2) {
        arrowPlacements.push({ x: p2.x - dx / segLen * 2, y: p2.y - dy / segLen * 2, angle: angle, sharp: true });
      } else if (segLen > 120) {
        arrowPlacements.push({ x: p1.x + dx * 0.5, y: p1.y + dy * 0.5, angle: angle });
      }
    }
    var filtered = [];
    for (var i = 0; i < arrowPlacements.length; i++) {
      var a = arrowPlacements[i];
      var tooClose = false;
      for (var k = 0; k < filtered.length; k++) {
        var ddx = a.x - filtered[k].x, ddy = a.y - filtered[k].y;
        if (Math.sqrt(ddx * ddx + ddy * ddy) < minDist) { tooClose = true; break; }
      }
      if (!tooClose) filtered.push(a);
    }
    for (var i = 0; i < filtered.length; i++) {
      var a = filtered[i];
      ctx2.save();
      ctx2.translate(a.x, a.y);
      ctx2.rotate(a.angle);
      if (a.sharp) {
        ctx2.beginPath();
        ctx2.moveTo(arrowLen, 0);
        ctx2.lineTo(-2, -arrowWidth);
        ctx2.lineTo(-2, arrowWidth);
        ctx2.closePath();
      } else {
        var half = arrowLen * 0.4;
        ctx2.beginPath();
        ctx2.moveTo(half, 0);
        ctx2.lineTo(-half, -arrowWidth);
        ctx2.lineTo(-half, 0);
        ctx2.lineTo(-half, arrowWidth);
        ctx2.closePath();
      }
      ctx2.fillStyle = color;
      ctx2.fill();
      ctx2.restore();
    }
  }

  return {
    init: init, render: render, setTool: setTool, clearAll: clearAll,
    addBgImage: addBgImage, removeBgLayer: removeBgLayer, fitToAll: fitToAll,
    getData: getData, setData: setData, getFullImageDataURL: getFullImageDataURL,
    setDrawColor: setDrawColor, setDrawWidth: setDrawWidth,
    getTool: function() { return tool; },
    getBgLayers: function() { return bgLayers; },
    getObjects: function() { return objects; },
    getPaths: function() { return paths; },
    getSymbols: function() { return symbols; },
    getLabels: function() { return labels; },
    setZoom: function(z) { zoom = z; render(); },
    setPan: function(x, y) { panX = x; panY = y; render(); }
  };
})();
