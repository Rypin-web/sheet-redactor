/**
 * Модуль создания сводного листа аварий
 * Создаёт лист "Свод аварий" при наличии двух alarm-отчётов
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
 * Создать сводный лист аварий
 * @param {object} workbook - Workbook объект SheetJS
 * @param {string} alarmReportA - Имя файла alarm-table для точки А
 * @param {string} alarmReportB - Имя файла alarm-table для точки Б
 */
function createSvodAlarmSheet(workbook, alarmReportA, alarmReportB) {
    console.log('\n=== СОЗДАНИЕ ЛИСТА "СВОД АВАРИЙ" ===');

    // Проверяем, что оба отчёта выбраны
    const hasA = alarmReportA && alarmReportA !== '';
    const hasB = alarmReportB && alarmReportB !== '';

    if (!hasA || !hasB) {
        console.log('  Один или оба alarm-отчёта не выбраны, пропускаем');
        return;
    }

    // Читаем оба alarm-отчёта
    console.log('  Чтение alarm-отчётов...');
    const alarmDataA = fs.readXLSX(alarmReportA);
    const alarmDataB = fs.readXLSX(alarmReportB);

    // Находим индексы столбца AlarmName
    const alarmNameIdxA = findColumnIndex(alarmDataA.headers, 'AlarmName', 'Alarm Name');
    const alarmNameIdxB = findColumnIndex(alarmDataB.headers, 'AlarmName', 'Alarm Name');

    if (alarmNameIdxA === -1 || alarmNameIdxB === -1) {
        console.error('  ❌ Не найден столбец AlarmName в alarm-table');
        return;
    }

    // Собираем все уникальные AlarmName и считаем количество
    const allAlarmNames = new Set();
    const countA = new Map();  // AlarmName → количество в точке А
    const countB = new Map();  // AlarmName → количество в точке Б

    // Подсчитываем для точки А
    for (const row of alarmDataA.rows) {
        const name = row[alarmNameIdxA];
        if (!name) continue;

        allAlarmNames.add(name);
        countA.set(name, (countA.get(name) || 0) + 1);
    }

    // Подсчитываем для точки Б
    for (const row of alarmDataB.rows) {
        const name = row[alarmNameIdxB];
        if (!name) continue;

        allAlarmNames.add(name);
        countB.set(name, (countB.get(name) || 0) + 1);
    }

    console.log(`  Найдено уникальных аварий: ${allAlarmNames.size}`);
    console.log(`  В точке А: ${alarmDataA.rows.length} записей`);
    console.log(`  В точке Б: ${alarmDataB.rows.length} записей`);

    // Формируем данные для сводной таблицы
    const svodData = [];

    for (const alarmName of allAlarmNames) {
        const bylo = countA.get(alarmName) || 0;
        const stalo = countB.get(alarmName) || 0;
        const raznica = stalo - bylo;

        // Формула: 1 - (Стало / Было)
        // Если Было = 0, то процент = 0 (или 100% ухудшения)
        let percent;
        if (stalo === 0) {
            // Если в точке А не было аварий, а в точке Б появились — это 100% ухудшение
            percent = bylo > 0 ? 1 : 0;
        } else {
            percent = 1 - (bylo / stalo);
        }

        svodData.push({
            'Аварии': alarmName,
            'Было': bylo,
            'Стало': stalo,
            'Разница': raznica,
            'Ухудшились в %': percent
        });
    }

    // Сортировка по убыванию "Ухудшились в %"
    svodData.sort((a, b) => b['Ухудшились в %'] - a['Ухудшились в %']);

    // Создаём лист "Свод аварий"
    const svodSheet = XLSX.utils.json_to_sheet(svodData);

    // Выравниваем столбцы
    const headers = ['Аварии', 'Было', 'Стало', 'Разница', 'Ухудшились в %'];
    const colWidths = headers.map(h => ({ wch: Math.max(h.length, 15) * 0.8 }));
    svodSheet['!cols'] = colWidths;

    // Добавляем процентный формат для столбца "Ухудшились в %"
    // (SheetJS не поддерживает напрямую форматы, но Excel сам распознает числа < 1 как проценты)

    // Добавляем лист в workbook
    XLSX.utils.book_append_sheet(workbook, svodSheet, 'Свод аварий')

    console.log('✅ Лист "Свод аварий" создан');
    console.log(`  Записей: ${svodData.length}`);
}

module.exports = {
    createSvodAlarmSheet,
    findColumnIndex
};
