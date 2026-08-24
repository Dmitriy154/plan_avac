// ==================== ЭКСПОРТ В PDF ====================
// Генерация PDF документа плана эвакуации (формат А3)
const ExportPDF = (function() {
  'use strict';

  // Генерация HTML для PDF
  function generateHTML(canvasData, textData) {
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>';
    html += 'body { font-family: Arial, sans-serif; margin: 0; padding: 20px; font-size: 12px; }';
    html += '.page { width: 420mm; min-height: 297mm; padding: 15mm; box-sizing: border-box; }';
    html += 'h2 { text-align: center; margin-bottom: 5px; font-size: 16px; }';
    html += 'h3 { text-align: center; margin-bottom: 15px; font-size: 13px; color: #555; }';
    html += '.approval { border: 1px solid #333; padding: 10px; margin-bottom: 15px; }';
    html += '.approval-line { margin-bottom: 5px; }';
    html += '.approval-label { font-weight: bold; }';
    html += '.approval-value { border-bottom: 1px solid #333; display: inline-block; min-width: 150px; padding: 0 4px; }';
    html += 'table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }';
    html += 'th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; font-size: 11px; }';
    html += 'th { background: #f0f0f0; font-weight: bold; }';
    html += '.phones { margin-bottom: 15px; padding: 10px; background: #f8f8f8; border-radius: 4px; }';
    html += '.phones h4 { margin: 0 0 8px 0; font-size: 13px; }';
    html += '.phone-row { margin-bottom: 4px; }';
    html += '.phone-label { font-weight: bold; }';
    html += '.phone-num { color: #dc2626; font-weight: bold; font-size: 14px; }';
    html += '.requisites { margin-bottom: 15px; padding: 10px; background: #f8f8f8; border-radius: 4px; }';
    html += '.req-row { margin-bottom: 4px; }';
    html += '.req-label { font-weight: bold; }';
    html += '.req-value { border-bottom: 1px solid #333; display: inline-block; min-width: 200px; padding: 0 4px; }';
    html += '.canvas-area { border: 1px solid #ccc; margin-bottom: 15px; text-align: center; }';
    html += '.canvas-area img { max-width: 100%; max-height: 180mm; }';
    html += '.legend { font-size: 10px; margin-bottom: 10px; }';
    html += '.legend-item { display: inline-block; margin-right: 15px; }';
    html += '.legend-line { display: inline-block; width: 30px; height: 3px; vertical-align: middle; margin-right: 4px; }';
    html += '.legend-line.dashed { background: repeating-linear-gradient(90deg, #d97706, #d97706 5px, transparent 5px, transparent 10px); }';
    html += '.legend-line.solid { background: #16a34a; }';
    html += '.footer { text-align: center; font-size: 10px; color: #888; margin-top: 20px; }';
    html += '</style></head><body><div class="page">';

    // Гриф утверждения
    html += '<div class="approval">';
    html += '<div class="approval-line"><span class="approval-label">Утверждаю</span> <span class="approval-value">' + esc(textData.approval.role) + '</span> <span class="approval-value">' + esc(textData.approval.org) + '</span></div>';
    html += '<div class="approval-line"><span class="approval-value">' + esc(textData.approval.name) + '</span></div>';
    html += '<div class="approval-line"><span class="approval-value">' + esc(textData.approval.date) + '</span></div>';
    html += '</div>';

    // Заголовок
    html += '<h2>ПЛАН ЭВАКУАЦИИ ЛЮДЕЙ ПРИ ПОЖАРЕ</h2>';
    html += '<h3>' + esc(textData.requisites.object) + '</h3>';

    // План этажа (canvas)
    html += '<div class="canvas-area">';
    html += '<div id="canvasImage"></div>';
    html += '</div>';

    // Условные обозначения
    html += '<div class="legend">';
    html += '<strong>Условные обозначения:</strong><br>';
    html += '<span class="legend-item"><span class="legend-line solid"></span> — основной путь эвакуации</span>';
    html += '<span class="legend-item"><span class="legend-line dashed"></span> — запасный путь эвакуации</span>';
    html += '<span class="legend-item">🔴 — ручной пожарный извещатель</span>';
    html += '<span class="legend-item">📞 — телефон</span>';
    html += '<span class="legend-item">🧯 — огнетушитель</span>';
    html += '<span class="legend-item">🚿 — пожарный кран</span>';
    html += '<span class="legend-item">💨 — кнопка запуска дымоудаления</span>';
    html += '<span class="legend-item">Вы здесь — место размещения плана</span>';
    html += '</div>';

    // Таблица инструкции
    html += '<table>';
    html += '<thead><tr><th style="width:5%">№</th><th style="width:40%">Порядок действий</th><th style="width:30%">Исполнитель</th><th style="width:25%">Примечание</th></tr></thead>';
    html += '<tbody>';
    for (var i = 0; i < textData.instructionRows.length; i++) {
      var r = textData.instructionRows[i];
      html += '<tr><td style="text-align:center">' + (i+1) + '</td>';
      html += '<td>' + esc(r.action) + '</td>';
      html += '<td>' + esc(r.executor) + '</td>';
      html += '<td>' + esc(r.note) + '</td></tr>';
    }
    html += '</tbody></table>';

    // Телефоны
    html += '<div class="phones">';
    html += '<h4>Телефоны для вызова:</h4>';
    html += '<div class="phone-row"><span class="phone-label">Пожарная охрана: </span><span class="phone-num">101</span></div>';
    html += '<div class="phone-row"><span class="phone-label">Единый номер: </span><span class="phone-num">112</span></div>';
    html += '<div class="phone-row"><span class="phone-label">Руководитель: </span>' + esc(textData.phones.director) + '</div>';
    html += '<div class="phone-row"><span class="phone-label">Ответственный дежурный: </span>' + esc(textData.phones.duty) + '</div>';
    html += '</div>';

    // Реквизиты
    html += '<div class="requisites">';
    html += '<div class="req-row"><span class="req-label">Наименование объекта: </span><span class="req-value">' + esc(textData.requisites.object) + '</span></div>';
    html += '<div class="req-row"><span class="req-label">Адрес объекта: </span><span class="req-value">' + esc(textData.requisites.address) + '</span></div>';
    html += '<div class="req-row"><span class="req-label">План составил: </span><span class="req-value">' + esc(textData.requisites.author) + '</span></div>';
    html += '<div class="req-row"><span class="req-label">Должность: </span><span class="req-value">' + esc(textData.requisites.authorRole) + '</span></div>';
    html += '</div>';

    html += '</div></body></html>';
    return html;
  }

  function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Экспорт в PDF через html2canvas + jsPDF
  function exportToPDF(canvasData, textData) {
    var renderArea = document.getElementById('pdfRenderArea');
    renderArea.innerHTML = generateHTML(canvasData, textData);
    renderArea.style.display = 'block';
    renderArea.style.position = 'absolute';
    renderArea.style.left = '-9999px';
    renderArea.style.top = '0';
    renderArea.style.width = '420mm';
    renderArea.style.height = '297mm';

    // Вставляем полное изображение плана (с подложками)
    var canvasImg = renderArea.querySelector('#canvasImage');
    if (canvasImg && canvasData) {
      var imgSrc = CanvasEditor.getFullImageDataURL();
      if (imgSrc) {
        var img = document.createElement('img');
        img.src = imgSrc;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '180mm';
        canvasImg.appendChild(img);
      }
    }

    setTimeout(function() {
      html2canvas(renderArea, {
        scale: 2,
        useCORS: true,
        width: renderArea.scrollWidth,
        height: renderArea.scrollHeight,
        windowWidth: renderArea.scrollWidth,
        windowHeight: renderArea.scrollHeight
      }).then(function(canvasEl) {
        var imgData = canvasEl.toDataURL('image/png');
        var jsPDF = window.jspdf.jsPDF;
        var pdf = new jsPDF('l', 'mm', 'a3'); // альбомный А3
        var pdfWidth = 420;
        var pdfHeight = 297;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save((textData.requisites.object || 'plan_evacuation') + '.pdf');
        renderArea.style.display = 'none';
      }).catch(function(err) {
        alert('Ошибка генерации PDF: ' + err.message);
        renderArea.style.display = 'none';
      });
    }, 500);
  }

  return {
    generateHTML: generateHTML,
    exportToPDF: exportToPDF
  };
})();
