/**
 * Сценарий 3: "Новые данные. Точки в одной таблице"
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

/**
 * Сценарий 3: массив шагов
 * Поток: Главное меню -> Таблица 1 (CCSR для А и Б) -> НАЗВАНИЯ -> CCSR -> Точка А -> Точка Б ->
 *        Таблица 2 (Rate lookup) -> НАЗВАНИЯ -> Rate -> Выполнение
 */
const scenario3 = [
    // Шаг 0: Выбор сценария
    () => steps.chooseScenario(),

    // Шаг 1: Выбор первой таблицы (CCSR для точек А и Б)
    () => steps.promptTable('table1', 'Выберите таблицу 1 (с данными KPI для точек А и Б)'),

    // Шаг 2: Выбор заголовка НАЗВАНИЯ для таблицы 1
    () => steps.promptTitle('table1'),

    // Шаг 3: Выбор заголовка CCSR для таблицы 1
    () => steps.promptValue1('table1'),

    // Шаг 4: Выбор даты для точки А
    () => steps.promptPoint('А', 'table1'),

    // Шаг 5: Выбор даты для точки Б
    () => steps.promptPoint('Б', 'table1'),

    // Шаг 6: Выбор второй таблицы (Rate lookup)
    () => steps.promptTable('table2', 'Выберите таблицу 2 (с данными ВЕСА сот)'),

    // Шаг 7: Выбор заголовка НАЗВАНИЯ для таблицы 2
    () => steps.promptTitle('table2'),

    // Шаг 8: Выбор заголовка Rate для таблицы 2
    () => steps.promptValue2('table2'),

    // Шаг 9: Выбор alarm-table для точки B
    () => steps.promptAlarmTable('A'),
    () => steps.promptAlarmTable('B'),

    // Шаг 10: Выполнение сценария
    executeScenario3
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
 * Выполнить сценарий 3
 */
async function executeScenario3() {
    // Получаем данные из state
    const pointA = state.getStateField('pointA');
    const pointB = state.getStateField('pointB');
    const ccsrName = state.getStateField('table1.value1');
    const rateName = state.getStateField('table2.value2');

    console.log(`\nПараметры:`);
    console.log(`  Точка А: ${pointA}`);
    console.log(`  Точка Б: ${pointB}`);
    console.log(`  CCSR столбец: ${ccsrName}`);
    console.log(`  Rate столбец: ${rateName} (из lookup таблицы)`);

    // 1. Извлекаем данные из таблиц
    const data1 = extractDataFromTable('table1', 'value1');  // CCSR из Таблицы 1
    console.log('Данные из первой таблицы: ', data1.length)
    const data2 = extractDataFromTable('table2', 'value2');  // Rate из Таблицы 2
    console.log('Данные из второй таблицы: ', data2.length)

    // 2. Находим самые свежие Rate по name
    const rateLookup = merger.findLatestValue2ByName(data2);

    // 3. Объединяем данные в сводную таблицу
    const { headers, rows } = merger.mergeTablesScenario3(
        data1,
        data2,
        ccsrName,
        rateName,
        pointA,
        pointB,
        rateLookup
    );

    // 4. Вычисляем Изменение CCSR (Б - А)
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

    // 7. Фильтруем отрицательные по Изменение (CCSR)
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
        bsSvodProcessor.createBsSvodSheet(workbook);
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

    // 15. Обрабатываем статистику по БС
    bsCellsProcessor.processBsCellsStats(workbook, data1);

    // 16. Записываем в файл
    const { filePath, filename } = fs.writeXLSX(workbook);

    // 17. Открываем файл
    fs.openFile(filePath);

    return true;
}

module.exports = { executeScenario3, scenario3 };
