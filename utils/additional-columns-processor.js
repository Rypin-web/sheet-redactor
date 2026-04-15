/**
 * Модуль добавления дополнительных столбцов
 * Добавляет выбранные пользователем столбцы на листы "Ухудшились" и "ТОП-10"
 * Формат: (Дата А) Значение\n(Дата Б) Значение
 */

const XLSX = require('xlsx');
const parser = require('../modules/parser');
const fs = require('../modules/filesystem');
const state = require('./state');

/**
 * Найти значение для дополнительной колонки по названию соты и дате
 * @param {Array<{date: string, title: string, [key: string]: any}>} allData - Данные со всеми столбцами
 * @param {string} fullName - Полное название соты
 * @param {string} pointDate - Дата точки (DD.MM.YY HH:MM)
 * @param {string} dateOnly - Только дата (DD.MM.YY) для поиска по дате
 * @param {string} columnName - Имя столбца для поиска значения
 * @returns {any} Значение или пустая строка
 */
function findValueForColumn(allData, fullName, pointDate, dateOnly, columnName) {
    // Ищем запись с таким названием соты и датой
    for (const item of allData) {
        if (item.title !== fullName) continue;
        
        // Сначала ищем точное совпадение по дате
        if (item.date === pointDate) {
            return item[columnName] ?? '';
        }
        
        // Если не найдено, ищем по дате без времени
        const itemDateOnly = item.date.split(' ')[0];
        if (itemDateOnly === dateOnly) {
            return item[columnName] ?? '';
        }
    }
    
    return '';
}

/**
 * Извлечь данные из таблицы со всеми столбцами
 * @param {string} tableKey - Ключ таблицы в state ('table1', 'table2')
 * @returns {{data: Array, headers: string[]}} Данные и заголовки
 */
function extractAllDataFromTable(tableKey) {
    const fileName = state.getStateField(`${tableKey}.file`);
    const titleKey = state.getStateField(`${tableKey}.title`);
    
    if (!fileName || !titleKey) {
        return { data: [], headers: [] };
    }
    
    // Читаем файл
    const fileData = fs.readXLSX(fileName);
    const { headers, rows } = fileData;
    
    // Находим индексы столбцов
    const dateIndex = parser.findDateColumnIndex(headers);
    const titleIndex = headers.indexOf(titleKey);
    
    if (dateIndex === null || titleIndex === -1) {
        return { data: [], headers: [] };
    }
    
    // Извлекаем данные со всеми столбцами
    const data = parser.extractDataWithAllColumns(rows, headers, dateIndex, titleIndex);
    
    return { data, headers };
}

/**
 * Добавить дополнительные столбцы на лист
 * @param {object} workbook - Workbook объект SheetJS
 * @param {string} sheetName - Название листа ("Ухудшились" или "ТОП-10")
 * @param {string[]} additionalColumns - Массив названий столбцов
 * @param {string} pointA - Дата точки А (DD.MM.YY HH:MM)
 * @param {string} pointB - Дата точки Б (DD.MM.YY HH:MM)
 * @param {string[]} tableKeys - Массив ключей таблиц для поиска (например, ['table1', 'table2'])
 */
function addAdditionalColumnsToSheet(workbook, sheetName, additionalColumns, pointA, pointB, tableKeys = ['table1', 'table2']) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
        console.error(`❌ Лист "${sheetName}" не найден`);
        return;
    }

    // Преобразуем лист в массив объектов
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
        console.log(`  Лист "${sheetName}" пуст, пропускаем дополнительные столбцы`);
        return;
    }

    // Извлекаем данные из указанных таблиц
    let allTableData = [];
    for (const tableKey of tableKeys) {
        const tableData = extractAllDataFromTable(tableKey);
        allTableData = [...allTableData, ...tableData.data];
    }

    console.log(`  Добавление ${additionalColumns.length} дополнительных столбцов на лист "${sheetName}"...`);

    // Для каждой строки добавляем дополнительные столбцы
    for (const row of data) {
        const fullName = row['Название'];

        if (!fullName) continue;

        // Для каждого дополнительного столбца
        for (const columnName of additionalColumns) {
            // Ищем значения в данных таблиц для точек А и Б
            const valueA = findValueForColumn(allTableData, fullName, pointA, pointA, columnName);
            const valueB = findValueForColumn(allTableData, fullName, pointB, pointB, columnName);

            // Два столбца: {Название} было и {Название} стало
            row[`${columnName} было`] = valueA;
            row[`${columnName} стало`] = valueB;
        }
    }

    // Обновляем заголовки: убираем старые дополнительные столбцы
    const originalHeaders = Object.keys(data[0])
        .filter(h => !h.endsWith(' (доп)') && !h.endsWith(' было') && !h.endsWith(' стало'));

    // Добавляем новые столбцы: для каждого доп. столбца — "было" и "стало"
    const newHeaders = [...originalHeaders];
    for (const columnName of additionalColumns) {
        newHeaders.push(`${columnName} было`);
        newHeaders.push(`${columnName} стало`);
    }

    // Пересоздаём лист
    const newSheet = XLSX.utils.json_to_sheet(data, { header: newHeaders });

    // Выравниваем столбцы
    const colWidths = newHeaders.map(h => ({ wch: Math.max(h.length, 15) * 0.9 }));
    newSheet['!cols'] = colWidths;

    // Заменяем лист в workbook
    workbook.Sheets[sheetName] = newSheet;

    console.log(`  Добавлено столбцов: ${additionalColumns.length * 2} (${additionalColumns.length} × было/стало)`);
}

/**
 * Получить пересечение заголовков двух таблиц
 * @param {string[]} headers1 - Заголовки первой таблицы
 * @param {string[]} headers2 - Заголовки второй таблицы
 * @returns {string[]} Общие заголовки
 */
function getCommonHeaders(headers1, headers2) {
    const set1 = new Set(headers1);
    const set2 = new Set(headers2);
    
    const common = [];
    for (const header of set1) {
        if (set2.has(header)) {
            common.push(header);
        }
    }
    
    return common.sort();
}

/**
 * Отфильтровать уже выбранные заголовки из списка
 * @param {string[]} headers - Список заголовков
 * @param {string[]} exclude - Заголовки для исключения
 * @returns {string[]} Отфильтрованные заголовки
 */
function filterExcludedHeaders(headers, exclude) {
    const excludeSet = new Set(exclude.map(h => h.toLowerCase().trim()));
    return headers.filter(h => !excludeSet.has(h.toLowerCase().trim()));
}

/**
 * Получить доступные заголовки для выбора
 * @param {string[]} headers1 - Заголовки таблицы 1
 * @param {string[]} headers2 - Заголовки таблицы 2
 * @param {string} title1 - Выбранный заголовок НАЗВАНИЯ из таблицы 1
 * @param {string} value1_1 - Выбранный заголовок value1 из таблицы 1
 * @param {string} value2_1 - Выбранный заголовок value2 из таблицы 1
 * @param {string} title2 - Выбранный заголовок НАЗВАНИЯ из таблицы 2
 * @param {string} value1_2 - Выбранный заголовок value1 из таблицы 2
 * @param {string} value2_2 - Выбранный заголовок value2 из таблицы 2
 * @returns {string[]} Доступные заголовки для выбора
 */
function getAvailableHeaders(headers1, headers2, title1, value1_1, value2_1, title2, value1_2, value2_2) {
    // Находим общие заголовки
    const common = getCommonHeaders(headers1, headers2);
    
    // Собираем все исключённые заголовки
    const excluded = [
        title1, value1_1, value2_1,
        title2, value1_2, value2_2
    ].filter(h => h && h !== '');
    
    // Фильтруем
    return filterExcludedHeaders(common, excluded);
}

module.exports = {
    addAdditionalColumnsToSheet,
    getCommonHeaders,
    filterExcludedHeaders,
    getAvailableHeaders,
    findValueForColumn
};
