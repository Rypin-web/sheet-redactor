/**
 * Сценарий 4: "Новые данные. Точки в разных таблицах"
 * Функция выполнения расчетов и определение шагов сценария
 */

const XLSX = require('xlsx');
const fs = require('../modules/filesystem');
const parser = require('../modules/parser');
const merger = require('../modules/merger');
const calculator = require('../modules/calculator');
const state = require('../utils/state');
const steps = require('../utils/steps');
const alarmProcessor = require('../utils/alarm-processor');
const bsCellsProcessor = require('../utils/bs-cells-processor');
const svodAlarmProcessor = require('../utils/svod-alarm-processor');
const bsSvodProcessor = require('../utils/bs-svod-processor');
const additionalColumnsProcessor = require('../utils/additional-columns-processor');

/**
 * Сценарий 4: массив шагов
 * Поток: Главное меню -> Таблица 1 (Точка А) -> НАЗВАНИЯ -> CCSR -> Точка А ->
 *        Таблица 2 (Точка Б) -> НАЗВАНИЯ -> CCSR -> Точка Б ->
 *        Таблица 3 (Rate lookup) -> НАЗВАНИЯ -> Rate -> Выполнение
 */
const scenario4 = [
    // Шаг 0: Выбор сценария
    () => steps.chooseScenario(),
    
    // Шаг 1: Выбор первой таблицы (Точка А)
    () => steps.promptTable('table1', 'Выберите таблицу 1 (с данными точки А)'),
    
    // Шаг 2: Выбор заголовка НАЗВАНИЯ для таблицы 1
    () => steps.promptTitle('table1'),
    
    // Шаг 3: Выбор заголовка CCSR для таблицы 1
    () => steps.promptValue1('table1'),
    
    // Шаг 4: Выбор даты для точки А
    () => steps.promptPoint('А', 'table1'),
    
    // Шаг 5: Выбор второй таблицы (Точка Б)
    () => steps.promptTable('table2', 'Выберите таблицу 2 (с данными точки Б)'),
    
    // Шаг 6: Выбор заголовка НАЗВАНИЯ для таблицы 2
    () => steps.promptTitle('table2'),
    
    // Шаг 7: Выбор заголовка CCSR для таблицы 2
    () => steps.promptValue1('table2'),
    
    // Шаг 8: Выбор даты для точки Б
    () => steps.promptPoint('Б', 'table2'),
    
    // Шаг 9: Выбор третьей таблицы (Rate lookup)
    () => steps.promptTable('table3', 'Выберите таблицу 3 (с данными Rate сот)'),
    
    // Шаг 10: Выбор заголовка НАЗВАНИЯ для таблицы 3
    () => steps.promptTitle('table3'),
    
    // Шаг 11: Выбор заголовка Rate для таблицы 3
    () => steps.promptValue2('table3'),

    // Шаг 12: Выбор alarm-table для точки B
    () => steps.promptAlarmTable('A'),
    () => steps.promptAlarmTable('B'),

    // Шаг 13: Выбор дополнительных столбцов
    () => steps.promptAdditionalColumns(['table1', 'table2']),

    // Шаг 14: Выполнение сценария
    executeScenario4
];

/**
 * Извлечь данные из таблицы по параметрам из state
 * @param {string} tableKey - Ключ таблицы в state
 * @param {string} valueKey - Ключ значения ('value1' для CCSR, 'value2' для Rate)
 * @returns {Array<{date: string, title: string, value: any}>}
 */
function extractDataFromTable(tableKey, valueKey) {
    const fileName = state.getStateField(`${tableKey}.file`);
    const titleKey = state.getStateField(`${tableKey}.title`);
    const valueName = state.getStateField(`${tableKey}.${valueKey}`);
    
    if (!fileName || !titleKey || !valueName) {
        throw new Error(`Недостаточно данных для ${tableKey}.${valueKey}`);
    }
    
    // Читаем файл
    const fileData = fs.readXLSX(fileName);
    const { headers, rows } = fileData;
    
    // Находим индексы столбцов
    const dateIndex = parser.findDateColumnIndex(headers);
    const titleIndex = headers.indexOf(titleKey);
    const valueIndex = headers.indexOf(valueName);
    
    if (dateIndex === null || titleIndex === -1 || valueIndex === -1) {
        throw new Error(`Не найдены нужные столбцы в файле ${fileName}`);
    }
    
    // Извлекаем данные
    return parser.extractData(rows, dateIndex, titleIndex, valueIndex);
}

/**
 * Извлечь данные для конкретной точки (фильтр по дате)
 * @param {string} tableKey - Ключ таблицы в state
 * @param {string} point - Точка ('pointA' или 'pointB')
 * @returns {Array<{date: string, title: string, value: any}>}
 */
function extractDataForPoint(tableKey, point) {
    const fileName = state.getStateField(`${tableKey}.file`);
    const titleKey = state.getStateField(`${tableKey}.title`);
    const valueName = state.getStateField(`${tableKey}.value1`);  // CCSR
    const pointDate = state.getStateField(point);
    
    if (!fileName || !titleKey || !valueName || !pointDate) {
        throw new Error(`Недостаточно данных для ${tableKey}.${point}`);
    }
    
    // Читаем файл
    const fileData = fs.readXLSX(fileName);
    const { headers, rows } = fileData;
    
    // Находим индексы столбцов
    const dateIndex = parser.findDateColumnIndex(headers);
    const titleIndex = headers.indexOf(titleKey);
    const valueIndex = headers.indexOf(valueName);
    
    if (dateIndex === null || titleIndex === -1 || valueIndex === -1) {
        throw new Error(`Не найдены нужные столбцы в файле ${fileName}`);
    }
    
    // Извлекаем все данные
    const allData = parser.extractData(rows, dateIndex, titleIndex, valueIndex);

    // Фильтруем по дате точки (точное совпадение или по дате без времени)
    const getDateOnly = (dateTime) => dateTime.split(' ')[0];
    const pointDateOnly = getDateOnly(pointDate);
    
    // Сначала ищем точное совпадение (с временем)
    let filtered = allData.filter(item => item.date === pointDate);
    
    // Если не найдено, ищем по дате без времени
    if (filtered.length === 0) {
        filtered = allData.filter(item => getDateOnly(item.date) === pointDateOnly);
        console.log(`  (Найдено по дате без времени: ${filtered.length} записей)`);
    } else {
        console.log(`  (Найдено по точной дате: ${filtered.length} записей)`);
    }
    
    return filtered;
}

/**
 * Выполнить сценарий 4
 */
async function executeScenario4() {
    // Получаем данные из state
    const pointA = state.getStateField('pointA');
    const pointB = state.getStateField('pointB');
    const ccsrName = state.getStateField('table1.value1');
    const rateName = state.getStateField('table3.value2');
    
    console.log(`\nПараметры:`);
    console.log(`  Точка А: ${pointA} (Таблица 1)`);
    console.log(`  Точка Б: ${pointB} (Таблица 2)`);
    console.log(`  CCSR столбец: ${ccsrName}`);
    console.log(`  Rate столбец: ${rateName} (из lookup таблицы)`);
    
    // 1. Извлекаем данные из таблиц

    // Таблица 1: CCSR для точки А (отфильтрованные по дате)
    const ccsrDataA = extractDataForPoint('table1', 'pointA');
    console.log('  KPI из первой таблиц: ', ccsrDataA.length)
    
    // Таблица 1: все данные (для подсчёта сот)
    const table1AllData = extractDataFromTable('table1', 'value1');
    
    // Таблица 2: CCSR для точки Б (отфильтрованные по дате)
    const ccsrDataB = extractDataForPoint('table2', 'pointB');
    console.log('  KPI из второй таблиц: ', ccsrDataB.length)

    // Таблица 3: Rate lookup
    const rateData = extractDataFromTable('table3', 'value2');
    console.log('  ВЕС из третьей таблицы', rateData.length)

    // 2. Находим самые свежие Rate по name
    const rateLookup = merger.findLatestValue2ByName(rateData);

    // 3. Объединяем данные в сводную таблицу

    // Группируем данные по названию
    const groupedCcsrA = new Map(ccsrDataA.map(item => [item.title, item.value]));
    const groupedCcsrB = new Map(ccsrDataB.map(item => [item.title, item.value]));
    
    // Собираем все уникальные названия
    const allTitles = new Set([...groupedCcsrA.keys(), ...groupedCcsrB.keys()]);
    const sortedTitles = Array.from(allTitles).sort();
    
    // Формируем заголовки
    const headers = ['Название'];
    headers.push(`${pointA} (${ccsrName})`);
    headers.push(`${pointB} (${ccsrName})`);
    headers.push(`Разница (${ccsrName})`);
    headers.push(`${rateName}`);
    
    // Формируем строки
    const rows = [];
    for (const title of sortedTitles) {
        const row = {
            'Название': title,
            [`${pointA} (${ccsrName})`]: groupedCcsrA.get(title) ?? '',
            [`${pointB} (${ccsrName})`]: groupedCcsrB.get(title) ?? '',
            [`${rateName}`]: rateLookup.get(title) ?? ''
        };
        rows.push(row);
    }
    
    // 4. Вычисляем разницу CCSR (Б - А)
    const withDifference = calculator.addDifferenceCcsrScenario3(
        rows,
        ccsrName,
        pointA,
        pointB
    );

    // 5. Сортируем по убыванию Rate
    const sortedData = calculator.sortByRate(withDifference, rateName);

    // 6. Создаём workbook с листом "Данные"
    const workbook = XLSX.utils.book_new();
    const dataSheet = XLSX.utils.json_to_sheet(sortedData);
    XLSX.utils.book_append_sheet(workbook, dataSheet, 'Исходные данные');

    // 7. Фильтруем отрицательные по Разница (CCSR)
    const negative = calculator.filterNegativeByCcsr(sortedData, ccsrName);

    // 8. Создаём лист "Отрицательные" (пока без аварий)
    const negativeSheet = XLSX.utils.json_to_sheet(negative);
    XLSX.utils.book_append_sheet(workbook, negativeSheet, 'Ухудшились');

    // 9. Добавляем столбец "БС" на все листы
    alarmProcessor.addBsColumnToAllSheets(workbook);

    // 10. Обрабатываем Alarm-отчёты (на листе "Ухудшились")
    const alarmA = state.getStateField('alarmReport.pointA');
    const alarmB = state.getStateField('alarmReport.pointB');
    alarmProcessor.processAlarmReports(workbook, alarmA, alarmB);

    // 11. Создаём лист "Свод аварий" (если оба отчёта выбраны)
    if (alarmA && alarmB) {
        svodAlarmProcessor.createSvodAlarmSheet(workbook, alarmA, alarmB);

        // 12. Создаём лист "Свод по БС" (только если оба отчёта)
        bsSvodProcessor.createBsSvodSheet(workbook, alarmA, alarmB);
    }

    // 13. Читаем обновлённые данные из листа "Ухудшились" (теперь с БС и авариями)
    const updatedNegative = XLSX.utils.sheet_to_json(workbook.Sheets['Ухудшились']);

    // 13. Топ-10 по Rate (из обновлённых данных)
    const top10 = calculator.getTop10ByRate(updatedNegative, rateName);

    // 14. Создаём лист "Ухудшение"
    // Явно указываем заголовки, чтобы все столбцы попали на лист
    const allHeaders = Object.keys(top10[0]);
    const resultSheet = XLSX.utils.json_to_sheet(top10, { header: allHeaders });
    XLSX.utils.book_append_sheet(workbook, resultSheet, 'ТОП-10');

    // 15. Добавляем дополнительные столбцы (если выбраны)
    const additionalColumns = state.getStateField('additionalColumns');
    if (additionalColumns && additionalColumns.length > 0) {
        // Сценарий 4: данные из table1 и table2
        additionalColumnsProcessor.addAdditionalColumnsToSheet(
            workbook, 'Ухудшились', additionalColumns,
            pointA, pointB, ['table1', 'table2']
        );

        additionalColumnsProcessor.addAdditionalColumnsToSheet(
            workbook, 'ТОП-10', additionalColumns,
            pointA, pointB, ['table1', 'table2']
        );
    }

    // 16. Обрабатываем статистику по БС
    bsCellsProcessor.processBsCellsStats(workbook, table1AllData);

    // 17. Записываем в файл
    const { filePath, filename } = fs.writeXLSX(workbook);

    // 18. Открываем файл
    fs.openFile(filePath);

    return true;
}

module.exports = { executeScenario4, scenario4 };
