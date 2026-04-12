/**
 * Модуль создания сводной таблицы по БС
 * Создаёт лист "Свод по БС" при наличии двух alarm-отчётов
 * БС берутся из "Исходные данные", аварии — напрямую из alarm-таблиц
 */

const XLSX = require('xlsx');
const fs = require('../modules/filesystem');

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
 * Найти все аварии для одной БС в alarm-данных
 * Собирает аварии для всех сот данной БС
 * @param {object} alarmData - Данные alarm-table {headers, rows}
 * @param {string} bsName - Имя БС (например, "MK1234")
 * @param {string[]} cellNames - Массив названий сот этой БС
 * @returns {string[]} Массив строк с авариями (без дедупликации)
 */
function findAlarmsForBs(alarmData, bsName, cellNames) {
    const alarms = [];

    // Находим индексы столбцов
    const alarmSourceIdx = findColumnIndex(alarmData.headers, 'AlarmSource', 'Alarm Source');
    const alarmNameIdx = findColumnIndex(alarmData.headers, 'AlarmName', 'Alarm Name');
    const locationInfoIdx = findColumnIndex(alarmData.headers, 'LocationInformation', 'Location Information');

    if (alarmSourceIdx === -1 || alarmNameIdx === -1 || locationInfoIdx === -1) {
        return alarms;
    }

    // 1. Поиск по AlarmSource (по БС)
    for (const row of alarmData.rows) {
        const alarmSource = row[alarmSourceIdx];
        if (alarmSource === bsName) {
            const alarmName = row[alarmNameIdx];
            const location = row[locationInfoIdx];

            // Проверяем, есть ли в LocationInformation запись Cell Name
            const cellNameMatch = location && location.match(/Cell Name=([^,\s]+)/);

            if (cellNameMatch && cellNameMatch[1]) {
                // Найдена конкретная сота на этой БС
                // Формат: MK0002_02: Transport failure
                alarms.push(`${cellNameMatch[1]}: ${alarmName}`);
            } else {
                // Авария всей БС (без привязки к соте)
                // Формат: Transport failure
                alarms.push(alarmName);
            }
        }
    }

    // 2. Поиск по LocationInformation для каждой соты
    for (const cellName of cellNames) {
        const cellSearchString = `Cell Name=${cellName}`;

        for (const row of alarmData.rows) {
            const location = row[locationInfoIdx];
            if (location && location.includes(cellSearchString)) {
                const alarmName = row[alarmNameIdx];
                // Формат: MK0002_02: Transport failure
                alarms.push(`${cellName}: ${alarmName}`);
            }
        }
    }

    return alarms;
}

/**
 * Создать сводную таблицу по БС
 * @param {object} workbook - Workbook объект SheetJS
 * @param {string} alarmReportA - Имя файла alarm-table для точки А
 * @param {string} alarmReportB - Имя файла alarm-table для точки Б
 */
function createBsSvodSheet(workbook, alarmReportA, alarmReportB) {

    // Проверяем, что оба отчёта выбраны
    const hasA = alarmReportA && alarmReportA !== '';
    const hasB = alarmReportB && alarmReportB !== '';

    if (!hasA || !hasB) {
        console.log('  Один или оба alarm-отчёта не выбраны, пропускаем');
        return;
    }

    // 1. Получить лист "Исходные данные"
    const sourceSheet = workbook.Sheets['Исходные данные'];
    if (!sourceSheet) {
        console.error('  ❌ Лист "Исходные данные" не найден');
        return;
    }

    // 2. Преобразуем лист в массив объектов
    const sourceData = XLSX.utils.sheet_to_json(sourceSheet);

    if (sourceData.length === 0) {
        console.log('  Лист "Исходные данные" пуст, пропускаем');
        return;
    }

    // 3. Извлечь уникальные БС из "Исходные данные"
    const uniqueBsSet = new Set();
    for (const row of sourceData) {
        if (row['БС']) {
            uniqueBsSet.add(row['БС']);
        }
    }
    const uniqueBsList = Array.from(uniqueBsSet).sort();

    console.log('  Создание "Свод по БС"...');
    console.log(`  Найдено уникальных БС: ${uniqueBsList.length}`);

    // 4. Прочитать оба alarm-отчёта
    console.log('  Чтение alarm-отчётов...');
    const alarmDataA = fs.readXLSX(alarmReportA);
    const alarmDataB = fs.readXLSX(alarmReportB);

    // 5. Для каждой БС собрать информацию
    const bsStats = [];
    let processedCount = 0;

    console.log(' ')
    for (const bsName of uniqueBsList) {

        // Найти все соты этой БС в "Исходные данные"
        const rowsForBs = sourceData.filter(row => row['БС'] === bsName);
        const cellNames = rowsForBs
            .map(row => row['Название'])
            .filter(name => name);

        // Собрать аварии из alarmA
        const alarmsA = findAlarmsForBs(alarmDataA, bsName, cellNames);

        // Собрать аварии из alarmB
        const alarmsB = findAlarmsForBs(alarmDataB, bsName, cellNames);

        // Все аварии = alarmsA ∪ alarmsB (без дедупликации на этом этапе)
        const allAlarmsRaw = [...alarmsA, ...alarmsB];

        // Уникализируем аварии в пределах этой БС (Set)
        const allAlarmsSet = new Set(allAlarmsRaw);
        const allAlarms = Array.from(allAlarmsSet);

        // Новые аварии = есть в B, нет в A (тоже уникализируем)
        const alarmsASet = new Set(alarmsA);
        const newAlarmsRaw = alarmsB.filter(a => !alarmsASet.has(a));
        const newAlarmsSet = new Set(newAlarmsRaw);
        const newAlarms = Array.from(newAlarmsSet);

        // Логирование каждые 100 БС
        processedCount++;
        if (processedCount % 100 === 0 || processedCount === uniqueBsList.length) {
            console.log(`  Обработано БС: ${processedCount}/${uniqueBsList.length}`);
        }

        bsStats.push({
            'БС': bsName,
            'Все аварии': allAlarms.join('\n'),
            'Новые аварии': newAlarms.join('\n')
        });
    }

    // 6. Сортировка по количеству новых аварий (по убыванию)
    bsStats.sort((a, b) => {
        const newA = b['Новые аварии'] ? b['Новые аварии'].split('\n').filter(Boolean).length : 0;
        const newB = a['Новые аварии'] ? a['Новые аварии'].split('\n').filter(Boolean).length : 0;
        return newA - newB;
    });

    // 7. Создать лист "Свод по БС"
    const svodSheet = XLSX.utils.json_to_sheet(bsStats);

    // 8. Выравнивание столбцов
    const headers = ['БС', 'Все аварии', 'Новые аварии'];
    const colWidths = headers.map(h => ({ wch: Math.max(h.length, 15) * 0.8 }));
    svodSheet['!cols'] = colWidths;

    // 9. Добавить лист в workbook
    XLSX.utils.book_append_sheet(workbook, svodSheet, 'Свод по БС');

    console.log('  Лист "Свод по БС" создан');
    console.log(`  Записей: ${bsStats.length}\n`);
}

module.exports = {
    createBsSvodSheet,
    findAlarmsForBs
};
