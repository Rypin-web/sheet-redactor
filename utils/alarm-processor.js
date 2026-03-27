/**
 * Модуль обработки Alarm-отчёта
 * Добавляет столбец "БС" на лист "Исходные данные"
 * Добавляет столбцы "Аварии" на лист "Ухудшились"
 */

const XLSX = require('xlsx');
const fs = require('../modules/filesystem');

/**
 * Извлечь БС из полного имени соты
 * @param {string} fullName - Полное имя соты (например, "MK4345_02")
 * @returns {string} БС (например, "MK1345" или "MK0132")
 */
function extractBsName(fullName) {
    // Берём часть до "_"
    const bsPart = fullName.split('_')[0];  // "MK4345" или "LR0132"

    // Извлекаем буквы (первые 2) и цифры (4 знака)
    const letters = bsPart.match(/[A-Z]{2}/i);
    const numbersMatch = bsPart.match(/\d{4}/);

    if (!letters || !numbersMatch) {
        return bsPart;  // Если не удалось распознать, возвращаем как есть
    }

    const letterPart = letters[0];
    const numberStr = numbersMatch[0];  // "4345" или "0132" (строка!)
    const numberPart = parseInt(numberStr);  // 4345 или 132 (число)

    // Если число >= 3000, вычитаем 3000
    const bsNumber = numberPart >= 3000 ? numberPart - 3000 : numberPart;

    // Форматируем обратно с ведущими нулями (4 знака)
    const bsNumberStr = String(bsNumber).padStart(4, '0');

    return letterPart + bsNumberStr;
}

/**
 * Найти индекс столбца по названию (с проверкой вариантов с пробелом и без)
 * @param {string[]} headers - Массив заголовков
 * @param {string} name1 - Первый вариант названия (без пробела)
 * @param {string} name2 - Второй вариант названия (с пробелом)
 * @returns {number} Индекс столбца или -1
 */
function findColumnIndex(headers, name1, name2) {
    let index = headers.findIndex(h => h === name1);
    if (index >= 0) return index;

    index = headers.findIndex(h => h === name2);
    if (index >= 0) return index;

    return -1;
}

/**
 * Найти аварии для одной соты в alarm-данных
 * @param {Array} alarmBuffer - Данные alarm-table (массив объектов)
 * @param {string} bsName - Имя БС (например, "MK1234")
 * @param {string} fullName - Полное имя соты (например, "MK4234_02")
 * @param {number} alarmSourceIdx - Индекс столбца AlarmSource
 * @param {number} alarmNameIdx - Индекс столбца AlarmName
 * @param {number} locationInfoIdx - Индекс столбца LocationInformation
 * @returns {string[]} Массив строк с авариями
 */
function findAlarmsForCell(alarmBuffer, bsName, fullName, alarmSourceIdx, alarmNameIdx, locationInfoIdx) {
    const alarms = [];
    const bufferCopy = alarmBuffer.map(row => ({...row}));  // Копия для удаления
    const removeIndices = [];  // Индексы для удаления из оригинального буфера

    // 1. Поиск в AlarmSource (точное совпадение с БС)
    for (let i = bufferCopy.length - 1; i >= 0; i--) {
        const alarmSource = bufferCopy[i][alarmSourceIdx];
        if (alarmSource === bsName) {
            const alarmName = bufferCopy[i][alarmNameIdx];
            const location = bufferCopy[i][locationInfoIdx];

            // Проверяем, есть ли в LocationInformation запись Cell Name
            const cellNameMatch = location && location.match(/Cell Name=([^,\s]+)/);

            if (cellNameMatch && cellNameMatch[1]) {
                // Найдена конкретная сота на этой БС
                const cellName = cellNameMatch[1];
                alarms.push(`БС [${cellName}]: ${alarmName}`);
            } else {
                // Авария всей БС (без привязки к соте)
                alarms.push(`БС: ${alarmName}`);
            }

            // Помечаем для удаления
            removeIndices.push(i);
        }
    }

    // Удаляем найденные записи из копии
    for (const idx of removeIndices) {
        bufferCopy.splice(idx, 1);
    }

    // 2. Поиск в LocationInformation (по точному совпадению "Cell Name=[полное имя соты]")
    const cellSearchString = `Cell Name=${fullName}`;

    for (const alarmRow of bufferCopy) {
        const location = alarmRow[locationInfoIdx];
        if (location && location.includes(cellSearchString)) {
            const alarmName = alarmRow[alarmNameIdx];
            alarms.push(`СОТА: ${alarmName}`);
        }
    }

    return alarms;
}

/**
 * Добавить столбец "БС" на лист "Исходные данные"
 * @param {object} workbook - Workbook объект SheetJS
 */
function addBsColumnToSourceData(workbook) {
    console.log('\n=== ДОБАВЛЕНИЕ СТОЛБЦА "БС" НА ЛИСТ "ИСХОДНЫЕ ДАННЫЕ" ===');

    const sheet = workbook.Sheets['Исходные данные'];
    if (!sheet) {
        console.error('❌ Лист "Исходные данные" не найден');
        return;
    }

    // Преобразуем лист в массив объектов
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
        console.log('  Лист пуст, пропускаем');
        return;
    }

    // Добавляем БС к каждой строке
    for (const row of data) {
        const fullName = row['Название'];
        if (fullName) {
            row['БС'] = extractBsName(fullName);
        }
    }

    // Обновляем заголовки
    const originalHeaders = Object.keys(data[0]).filter(h => h !== 'БС');
    const newHeaders = ['БС', ...originalHeaders];

    // Пересоздаём лист
    const newSheet = XLSX.utils.json_to_sheet(data, { header: newHeaders });

    // Выравниваем столбцы
    const colWidths = newHeaders.map(h => ({ wch: Math.max(h.length, 5) * 0.8 }));
    newSheet['!cols'] = colWidths;

    // Заменяем лист в workbook
    workbook.Sheets['Исходные данные'] = newSheet;

    console.log('✅ Столбец "БС" добавлен на лист "Исходные данные"');
}

/**
 * Обработать Alarm-отчёты и добавить данные на лист "Ухудшились"
 * @param {object} workbook - Workbook объект SheetJS
 * @param {string} alarmReportA - Имя файла alarm-table для точки А (или '')
 * @param {string} alarmReportB - Имя файла alarm-table для точки Б (или '')
 */
function processAlarmReports(workbook, alarmReportA, alarmReportB) {
    console.log('\n=== ОБРАБОТКА ALARM-ОТЧЁТОВ ===');

    // Определяем режим работы
    const hasA = alarmReportA && alarmReportA !== '';
    const hasB = alarmReportB && alarmReportB !== '';

    if (!hasA && !hasB) {
        console.log('  Alarm-отчёты не выбраны, пропускаем');
        return;
    }

    // Если выбрана только точка А — ничего не делаем (по ТЗ)
    if (hasA && !hasB) {
        console.log('  Выбран только alarm-report за точку А, пропускаем (по ТЗ)');
        return;
    }

    // Получаем лист "Ухудшились"
    const sheet = workbook.Sheets['Ухудшились'];
    if (!sheet) {
        console.error('❌ Лист "Ухудшились" не найден');
        return;
    }

    // Преобразуем лист в массив объектов
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
        console.log('  Лист "Ухудшились" пуст, пропускаем');
        return;
    }

    console.log(`  Обработка ${data.length} записей на листе "Ухудшились"...`);

    // РЕЖИМ 1: Только alarmReportB (старый режим)
    if (!hasA && hasB) {
        console.log('  Режим: только alarm-report за точку Б (старый режим)');
        processSingleAlarmReport(workbook, 'Ухудшились', data, alarmReportB, 'Аварии');
    }

    // РЕЖИМ 2: alarmReportA + alarmReportB (новый режим)
    if (hasA && hasB) {
        console.log('  Режим: два alarm-report (новый режим)');
        processDualAlarmReports(workbook, 'Ухудшились', data, alarmReportA, alarmReportB);
    }

    console.log('✅ Обработка alarm-отчётов завершена');
}

/**
 * Обработать один alarm-отчёт (старый режим)
 * @param {object} workbook - Workbook объект SheetJS
 * @param {string} sheetName - Название листа
 * @param {Array} data - Данные листа
 * @param {string} alarmFileName - Имя файла alarm-table
 * @param {string} columnName - Название столбца для записи
 */
function processSingleAlarmReport(workbook, sheetName, data, alarmFileName, columnName) {
    // Читаем alarm-table
    const alarmData = fs.readXLSX(alarmFileName);
    const { headers: alarmHeaders, rows: alarmRows } = alarmData;

    // Находим индексы столбцов
    const alarmSourceIdx = findColumnIndex(alarmHeaders, 'AlarmSource', 'Alarm Source');
    const alarmNameIdx = findColumnIndex(alarmHeaders, 'AlarmName', 'Alarm Name');
    const locationInfoIdx = findColumnIndex(alarmHeaders, 'LocationInformation', 'Location Information');

    if (alarmSourceIdx === -1 || alarmNameIdx === -1 || locationInfoIdx === -1) {
        console.error('  ❌ Не найдены нужные столбцы в alarm-table');
        return;
    }

    // Создаём буфер (копию) alarm-данных
    let alarmBuffer = alarmRows.map(row => ({...row}));

    // Для каждой строки (соты) ищем аварии
    for (const row of data) {
        const fullName = row['Название'];
        const bsName = row['БС'];

        if (!fullName || !bsName) continue;

        const alarms = findAlarmsForCell(
            alarmBuffer,
            bsName,
            fullName,
            alarmSourceIdx,
            alarmNameIdx,
            locationInfoIdx
        );

        row[columnName] = alarms.join('\n');
    }

    // Обновляем заголовки
    const originalHeaders = Object.keys(data[0]).filter(h => h !== columnName);
    const newHeaders = [...originalHeaders, columnName];

    // Пересоздаём лист
    const newSheet = XLSX.utils.json_to_sheet(data, { header: newHeaders });
    const colWidths = newHeaders.map(h => ({ wch: Math.max(h.length, 5) * 0.8 }));
    newSheet['!cols'] = colWidths;

    // Заменяем лист в workbook
    workbook.Sheets[sheetName] = newSheet;
}

/**
 * Обработать два alarm-отчёта (новый режим)
 * @param {object} workbook - Workbook объект SheetJS
 * @param {string} sheetName - Название листа
 * @param {Array} data - Данные листа
 * @param {string} alarmFileA - Имя файла alarm-table для точки А
 * @param {string} alarmFileB - Имя файла alarm-table для точки Б
 */
function processDualAlarmReports(workbook, sheetName, data, alarmFileA, alarmFileB) {
    // Читаем оба alarm-отчёта
    const alarmDataA = fs.readXLSX(alarmFileA);
    const alarmDataB = fs.readXLSX(alarmFileB);

    // Находим индексы столбцов для обоих отчётов
    const alarmSourceIdxA = findColumnIndex(alarmDataA.headers, 'AlarmSource', 'Alarm Source');
    const alarmNameIdxA = findColumnIndex(alarmDataA.headers, 'AlarmName', 'Alarm Name');
    const locationInfoIdxA = findColumnIndex(alarmDataA.headers, 'LocationInformation', 'Location Information');

    const alarmSourceIdxB = findColumnIndex(alarmDataB.headers, 'AlarmSource', 'Alarm Source');
    const alarmNameIdxB = findColumnIndex(alarmDataB.headers, 'AlarmName', 'Alarm Name');
    const locationInfoIdxB = findColumnIndex(alarmDataB.headers, 'LocationInformation', 'Location Information');

    if (alarmSourceIdxA === -1 || alarmNameIdxA === -1 || locationInfoIdxA === -1 ||
        alarmSourceIdxB === -1 || alarmNameIdxB === -1 || locationInfoIdxB === -1) {
        console.error('  ❌ Не найдены нужные столбцы в alarm-table');
        return;
    }

    // Создаём буферы для обоих отчётов
    let alarmBufferA = alarmDataA.rows.map(row => ({...row}));
    let alarmBufferB = alarmDataB.rows.map(row => ({...row}));

    // Для каждой строки (соты) ищем аварии в обоих отчётах
    for (const row of data) {
        const fullName = row['Название'];
        const bsName = row['БС'];

        if (!fullName || !bsName) continue;

        // Ищем аварии в отчёте А
        const alarmsA = findAlarmsForCell(
            alarmBufferA,
            bsName,
            fullName,
            alarmSourceIdxA,
            alarmNameIdxA,
            locationInfoIdxA
        );

        // Ищем аварии в отчёте Б
        const alarmsB = findAlarmsForCell(
            alarmBufferB,
            bsName,
            fullName,
            alarmSourceIdxB,
            alarmNameIdxB,
            locationInfoIdxB
        );

        // Все текущие аварии (объединение)
        const allAlarms = [...new Set([...alarmsA, ...alarmsB])];

        // Новые аварии (есть в Б, нет в А)
        const newAlarms = alarmsB.filter(a => !alarmsA.includes(a));

        // Записываем в столбцы
        row['Все текущие аварии'] = allAlarms.join('\n');
        row['Новые аварии'] = newAlarms.join('\n');
    }

    // Обновляем заголовки
    const originalHeaders = Object.keys(data[0]).filter(h => h !== 'Все текущие аварии' && h !== 'Новые аварии');
    const newHeaders = [...originalHeaders, 'Все текущие аварии', 'Новые аварии'];

    // Пересоздаём лист
    const newSheet = XLSX.utils.json_to_sheet(data, { header: newHeaders });
    const colWidths = newHeaders.map(h => ({ wch: Math.max(h.length, 5) * 0.8 }));
    newSheet['!cols'] = colWidths;

    // Заменяем лист в workbook
    workbook.Sheets[sheetName] = newSheet;

    console.log('  Добавлены столбцы: "Все текущие аварии", "Новые аварии"');
}

/**
 * Добавить столбец "БС" на все листы workbook
 * @param {object} workbook - Workbook объект SheetJS
 */
function addBsColumnToAllSheets(workbook) {
    console.log('\n=== ДОБАВЛЕНИЕ СТОЛБЦА "БС" НА ВСЕ ЛИСТЫ ===');

    const sheetNames = ['Исходные данные', 'Ухудшились', 'ТОП-10'];

    for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        // Преобразуем лист в массив объектов
        const data = XLSX.utils.sheet_to_json(sheet);

        if (data.length === 0) continue;

        // Добавляем БС к каждой строке (если ещё нет)
        let hasBs = false;
        for (const row of data) {
            if (row['БС']) {
                hasBs = true;
                break;
            }
        }

        if (!hasBs) {
            for (const row of data) {
                const fullName = row['Название'];
                if (fullName && !row['БС']) {
                    row['БС'] = extractBsName(fullName);
                }
            }
        }

        // Обновляем заголовки
        const originalHeaders = Object.keys(data[0]).filter(h => h !== 'БС');
        const newHeaders = ['БС', ...originalHeaders];

        // Пересоздаём лист
        const newSheet = XLSX.utils.json_to_sheet(data, { header: newHeaders });

        // Выравниваем столбцы
        const colWidths = newHeaders.map(h => ({ wch: Math.max(h.length, 5) * 0.8 }));
        newSheet['!cols'] = colWidths;

        // Заменяем лист в workbook
        workbook.Sheets[sheetName] = newSheet;
    }

    console.log('✅ Столбец "БС" добавлен на все листы');
}

module.exports = {
    extractBsName,
    findColumnIndex,
    findAlarmsForCell,
    addBsColumnToSourceData,
    addBsColumnToAllSheets,
    processAlarmReports,
    processSingleAlarmReport,
    processDualAlarmReports
};
