// ==================== ТЕКСТОВАЯ ЧАСТЬ ПЛАНА ЭВАКУАЦИИ ====================
// Генерация и редактирование текстовой части по приложению 2 к постановлению №82
const TextPart = (function() {
  'use strict';

  // Структура текстовой части по приложению 2 к постановлению МЧС РБ №82
  var instructionRows = [
    {
      num: 1,
      action: 'Обнаружив пожар (или получив сообщение о пожаре), немедленно сообщить об этом по телефону 101, указав: наименование объекта, адрес, место возникновения пожара, а также сообщить руководителю (лицу, ответственному за пожарную безопасность)',
      executor: 'Работник, обнаруживший пожар',
      note: ''
    },
    {
      num: 2,
      action: 'Оповестить людей о пожаре устно, по телефону, оповещателю или иным способом, обеспечив их безопасную эвакуацию',
      executor: 'Лицо, определённое общеобъектовой инструкцией по пожарной безопасности',
      note: ''
    },
    {
      num: 3,
      action: 'Организовать эвакуацию людей из помещений, в которых возник пожар, и смежных помещений, находящихся в путях эвакуации, вывести их в безопасные места (наружу здания, в лестничные клетки)',
      executor: 'Лицо, определённое общеобъектовой инструкцией по пожарной безопасности',
      note: ''
    },
    {
      num: 4,
      action: 'Принять посильное участие в тушении пожара до прибытия пожарного аварийно-спасательного подразделения, используя имеющиеся первичные средства пожаротушения',
      executor: 'Члены пожарной дружины',
      note: ''
    },
    {
      num: 5,
      action: 'Встретить пожарное аварийно-спасательное подразделение, указать место пожара, сообщить необходимые сведения, обеспечить доступ к внутреннему противопожарному водоснабжению и электрооборудованию',
      executor: 'Лицо, определённое общеобъектовой инструкцией по пожарной безопасности',
      note: ''
    }
  ];

  // Получение данных из DOM формы текстовой части
  function getFormData() {
    var table = document.getElementById('instructionTable');
    var rows = [];
    if (table) {
      var trs = table.querySelectorAll('tbody tr');
      trs.forEach(function(tr, i) {
        var tds = tr.querySelectorAll('td');
        rows.push({
          num: i + 1,
          action: tds[1] ? tds[1].textContent.trim() : '',
          executor: tds[2] ? tds[2].textContent.trim() : '',
          note: tds[3] ? tds[3].textContent.trim() : ''
        });
      });
    }
    return {
      approval: {
        role: document.getElementById('approvalRole') ? document.getElementById('approvalRole').textContent.trim() : '',
        org: document.getElementById('approvalOrg') ? document.getElementById('approvalOrg').textContent.trim() : '',
        name: document.getElementById('approvalName') ? document.getElementById('approvalName').textContent.trim() : '',
        date: document.getElementById('approvalDate') ? document.getElementById('approvalDate').textContent.trim() : ''
      },
      instructionRows: rows,
      phones: {
        fire: '101',
        unified: '112',
        director: document.getElementById('phoneDirector') ? document.getElementById('phoneDirector').textContent.trim() : '',
        duty: document.getElementById('phoneDuty') ? document.getElementById('phoneDuty').textContent.trim() : ''
      },
      requisites: {
        object: document.getElementById('reqObject') ? document.getElementById('reqObject').textContent.trim() : '',
        address: document.getElementById('reqAddress') ? document.getElementById('reqAddress').textContent.trim() : '',
        author: document.getElementById('reqAuthor') ? document.getElementById('reqAuthor').textContent.trim() : '',
        authorRole: document.getElementById('reqAuthorRole') ? document.getElementById('reqAuthorRole').textContent.trim() : ''
      }
    };
  }

  // Установка данных в DOM форму
  function setFormData(data) {
    if (!data) return;
    if (data.approval) {
      if (data.approval.role) setTextById('approvalRole', data.approval.role);
      if (data.approval.org) setTextById('approvalOrg', data.approval.org);
      if (data.approval.name) setTextById('approvalName', data.approval.name);
      if (data.approval.date) setTextById('approvalDate', data.approval.date);
    }
    if (data.phones) {
      if (data.phones.director) setTextById('phoneDirector', data.phones.director);
      if (data.phones.duty) setTextById('phoneDuty', data.phones.duty);
    }
    if (data.requisites) {
      if (data.requisites.object) setTextById('reqObject', data.requisites.object);
      if (data.requisites.address) setTextById('reqAddress', data.requisites.address);
      if (data.requisites.author) setTextById('reqAuthor', data.requisites.author);
      if (data.requisites.authorRole) setTextById('reqAuthorRole', data.requisites.authorRole);
    }
    if (data.instructionRows) {
      var table = document.getElementById('instructionTable');
      if (table) {
        var trs = table.querySelectorAll('tbody tr');
        data.instructionRows.forEach(function(row, i) {
          if (trs[i]) {
            var tds = trs[i].querySelectorAll('td');
            if (tds[1]) tds[1].textContent = row.action;
            if (tds[2]) tds[2].textContent = row.executor;
            if (tds[3]) tds[3].textContent = row.note;
          }
        });
      }
    }
  }

  function setTextById(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  return {
    instructionRows: instructionRows,
    getFormData: getFormData,
    setFormData: setFormData
  };
})();
