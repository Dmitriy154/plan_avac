// ==================== ПОЖАРНЫЕ СИМВОЛЫ (ГОСТ 12.1.114-82, ГОСТ 28130-89) ====================
const FireSymbols = (function() {
  'use strict';

  // Список символов по ГОСТ
  var SYMBOLS = [
    { id: 'rpi', name: 'Ручной пожарный извещатель', icon: '🔴', color: '#dc2626', size: 24 },
    { id: 'phone', name: 'Телефон', icon: '📞', color: '#2563eb', size: 24 },
    { id: 'extinguisher', name: 'Огнетушитель', icon: '🧯', color: '#dc2626', size: 28 },
    { id: 'hydrant', name: 'Пожарный кран', icon: '🚿', color: '#dc2626', size: 28 },
    { id: 'sdup', name: 'Кнопка запуска дымоудаления', icon: '💨', color: '#7c3aed', size: 24 },
    { id: 'alarm', name: 'Оповещатель', icon: '🔔', color: '#f59e0b', size: 24 },
    { id: 'exit', name: 'Эвакуационный выход', icon: '🚪', color: '#16a34a', size: 32 },
    { id: 'fireAlarm', name: 'Пожарная сигнализация', icon: '🚨', color: '#dc2626', size: 24 }
  ];

  function getSymbol(id) {
    return SYMBOLS.find(function(s) { return s.id === id; });
  }

  function getAll() {
    return SYMBOLS;
  }

  // Отрисовка символа на canvas
  function draw(ctx, symbolId, x, y, scale) {
    var sym = getSymbol(symbolId);
    if (!sym) return;
    var s = (scale || 1) * sym.size;
    ctx.save();
    // Фон-круг
    ctx.beginPath();
    ctx.arc(x, y, s / 2 + 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = sym.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Иконка
    ctx.font = (s * 0.8) + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = sym.color;
    ctx.fillText(sym.icon, x, y);
    ctx.restore();
  }

  // Попадание в символ
  function hitTest(symbol, mx, my) {
    var dx = mx - symbol.x;
    var dy = my - symbol.y;
    var r = (symbol.scale || 1) * (getSymbol(symbol.type) || { size: 24 }).size / 2 + 4;
    return dx * dx + dy * dy <= r * r;
  }

  return {
    SYMBOLS: SYMBOLS,
    getSymbol: getSymbol,
    getAll: getAll,
    draw: draw,
    hitTest: hitTest
  };
})();
