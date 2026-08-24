// ==================== ПУТИ ЭВАКУАЦИИ ====================
// Логика отрисовки и управления путями эвакуации
const Evacuation = (function() {
  'use strict';

  // Типы путей
  var PATH_TYPES = {
    main: { color: '#16a34a', label: 'Основной путь', dashed: false, width: 4 },
    reserve: { color: '#d97706', label: 'Запасный путь', dashed: true, width: 4 }
  };

  // Отрисовка стрелки направления
  function drawArrow(ctx, x, y, angle, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  // Проверка пересечения двух отрезков
  function segmentsIntersect(a1, a2, b1, b2) {
    var d1 = direction(b1, b2, a1);
    var d2 = direction(b1, b2, a2);
    var d3 = direction(a1, a2, b1);
    var d4 = direction(a1, a2, b2);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }
    return false;
  }

  function direction(pi, pj, pk) {
    return (pk.x - pi.x) * (pj.y - pi.y) - (pj.x - pi.x) * (pk.y - pi.y);
  }

  // Проверка, лежит ли точка на отрезке
  function onSegment(pi, pj, pk) {
    if (Math.min(pi.x, pj.x) <= pk.x && pk.x <= Math.max(pi.x, pj.x) &&
        Math.min(pi.y, pj.y) <= pk.y && pk.y <= Math.max(pi.y, pj.y)) {
      return true;
    }
    return false;
  }

  // Проверка, пересекает ли путь стены
  function pathCrossesWalls(points, walls) {
    for (var i = 0; i < points.length - 1; i++) {
      for (var j = 0; j < walls.length; j++) {
        var w = walls[j];
        if (w.type !== 'wall') continue;
        var corners = [
          { x: w.x, y: w.y },
          { x: w.x + w.w, y: w.y },
          { x: w.x + w.w, y: w.y + w.h },
          { x: w.x, y: w.y + w.h }
        ];
        for (var k = 0; k < 4; k++) {
          var next = (k + 1) % 4;
          if (segmentsIntersect(points[i], points[i+1], corners[k], corners[next])) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Автоматическое построение пути (упрощённое)
  function autoPath(startPt, endPt, walls) {
    // Простая прямая линия (в будущем можно добавить A* pathfinding)
    return [startPt, endPt];
  }

  return {
    PATH_TYPES: PATH_TYPES,
    drawArrow: drawArrow,
    pathCrossesWalls: pathCrossesWalls,
    autoPath: autoPath
  };
})();
