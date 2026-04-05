/**
 * Сценарий 1: "Старые данные. Обе точки находятся в первой таблице"
 * Функция выполнения расчетов и определение шагов сценария
 */

const XLSX = require('xlsx');
const fs = require('../modules/filesystem');
const parser = require('../modules/parser');
const merger = require('../modules/merger');
const calculator = require('../modules/calculator');
const state = require('../utils/state');
const steps = require('../utils/steps');
const additionalColumnsProcessor = require('../utils/additional-columns-processor');
const alarmProcessor = require('../utils/alarm-processor');
const bsSvodProcessor = require('../utils/bs-svod-processor');
const bsCellsProcessor = require('../utils/bs-cells-processor');
const svodAlarmProcessor = require('../utils/svod-alarm-processor');

/**
 * Сценарий 1: массив шагов
 * Поток: Главное меню -> Таблица 1 -> НАЗВАНИЯ -> CCSR -> Rate -> Точка А -> Точка Б ->
 *        Таблица 2 -> НАЗВАНИЯ -> Rate -> Выполнение
 */
const scenario1 = [
    // Шаг 0: Выбор сценария
    () => steps.chooseScenario(),
    
    // Шаг 1: Выбор первой таблицы
    () => steps.promptTable('table1', 'Выберите таблицу 1 (с данными точек А и Б)'),
    
    // Шаг 2: Выбор заголовка НАЗВАНИЯ для таблицы 1
    () => steps.promptTitle('table1'),
    
    // Шаг 3: Выбор заголовка CCSR для таблицы 1
    () => steps.promptValue1('table1'),

    // Шаг 5: Выбор даты для точки А
    () => steps.promptPoint('А', 'table1'),
    
    // Шаг 6: Выбор даты для точки Б
    () => steps.promptPoint('Б', 'table1'),
    
    // Шаг 7: Выбор второй таблицы
    () => steps.promptTable('table2', 'Выберите таблицу 2 (с данными Rate сот)'),
    
    // Шаг 8: Выбор заголовка НАЗВАНИЯ для таблицы 2
    () => steps.promptTitle('table2'),
    
    // Шаг 9: Выбор заголовка Rate для таблицы 2
    () => steps.promptValue2('table2'),

    // Шаг 10: Выбор дополнительных столбцов
    () => steps.promptAdditionalColumns(),

    // Шаг 11: Выбор alarm-table для точки A
    () => steps.promptAlarmTable('A'),
    // Шаг 12: Выбор alarm-table для точки B
    () => steps.promptAlarmTable('B'),

    // Шаг 13: Выполнение сценария
    executeScenario1
];

/**
 * Извлечь данные из таблицы по параметрам из state
 * @param {string} tableKey - Ключ таблицы в state ('table1', 'table2')
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
 * Выполнить сценарий 1
 */
async function executeScenario1() {
    console.log('\n=== ВЫПОЛНЕНИЕ СЦЕНАРИЯ 1 ===');
    
    // Получаем данные из state
    const pointA = state.getStateField('pointA');
    const pointB = state.getStateField('pointB');
    const ccsrName = state.getStateField('table1.value1');
    const rateName = state.getStateField('table2.value2');
    
    console.log(`\nПараметры:`);
    console.log(`  Точка А: ${pointA}`);
    console.log(`  Точка Б: ${pointB}`);
    console.log(`  CCSR столбец: ${ccsrName}`);
    console.log(`  Rate столбец: ${rateName}`);
    
    // 1. Извлекаем данные из таблиц
    const data1 = extractDataFromTable('table1', 'value1');  // CCSR из Таблицы 1
    console.log('Данные из первой таблицы: ', data1.length)
    const data2 = extractDataFromTable('table2', 'value2');  // Rate из Таблицы 2
    console.log('Данные из второй таблицы: ', data2.length)

    // 2. Объединяем данные в сводную таблицу
    const { headers, rows } = merger.mergeTablesScenario1(
        data1,
        data2,
        ccsrName,
        rateName,
        pointA,
        pointB
    );

    // 3. Вычисляем разницу (Б - А)
    const withDifference = calculator.addDifferenceColumnsScenario1(
        rows,
        ccsrName,
        rateName,
        pointA,
        pointB,
    );

    // 4. Сортируем по убыванию Разница (Rate)
    const sortedData = calculator.sortByDifferenceRate(withDifference, rateName);

    // 5. Создаём workbook с листом "Данные"
    const workbook = XLSX.utils.book_new();
    const dataSheet = XLSX.utils.json_to_sheet(sortedData);
    XLSX.utils.book_append_sheet(workbook, dataSheet, 'Исходные данные');

    // 6. Фильтруем отрицательные по Разница (CCSR)
    const negative = calculator.filterNegativeByCcsr(sortedData, ccsrName);

    // 7. Создаём лист "Отрицательные"
    const negativeSheet = XLSX.utils.json_to_sheet(negative);
    XLSX.utils.book_append_sheet(workbook, negativeSheet, 'Ухудшились');

    // 8. Добавляем столбец "БС" на все листы
    alarmProcessor.addBsColumnToAllSheets(workbook);

    // 9. Обрабатываем Alarm-отчёты (на листе "Ухудшились")
    const alarmA = state.getStateField('alarmReport.pointA');
    const alarmB = state.getStateField('alarmReport.pointB');
    alarmProcessor.processAlarmReports(workbook, alarmA, alarmB);

    // 10. Создаём лист "Свод аварий" (если оба отчёта выбраны)
    if (alarmA && alarmB) {
        svodAlarmProcessor.createSvodAlarmSheet(workbook, alarmA, alarmB);

        // 11. Создаём лист "Свод по БС"
        bsSvodProcessor.createBsSvodSheet(workbook, alarmA, alarmB);
    }

    // 12. Читаем обновлённые данные из листа "Ухудшились" (теперь с БС и авариями)
    const updatedNegative = XLSX.utils.sheet_to_json(workbook.Sheets['Ухудшились']);

    // 13. Топ-10 по Разница (Rate) (из обновлённых данных)
    const top10 = calculator.getTop10ByDifferenceRate(updatedNegative, rateName);

    // 14. Пересоздаём лист "ТОП-10" с обновлёнными данными
    const allHeaders = Object.keys(top10[0]);
    const resultSheet = XLSX.utils.json_to_sheet(top10, { header: allHeaders });
    XLSX.utils.book_append_sheet(workbook, resultSheet, 'ТОП-10');

    // 15. Обрабатываем статистику по БС (добавляем мини-таблицу на "ТОП-10")
    bsCellsProcessor.processBsCellsStats(workbook, data1);

    // 16. Добавляем дополнительные столбцы (если выбраны)
    const additionalColumns = state.getStateField('additionalColumns');
    if (additionalColumns && additionalColumns.length > 0) {
        // Добавляем на лист "Ухудшились"
        additionalColumnsProcessor.addAdditionalColumnsToSheet(
            workbook, 'Ухудшились', additionalColumns,
            pointA, pointB
        );

        // Добавляем на лист "ТОП-10"
        additionalColumnsProcessor.addAdditionalColumnsToSheet(
            workbook, 'ТОП-10', additionalColumns,
            pointA, pointB
        );
    }

    // 17. Записываем в файл
    const { filePath, filename } = fs.writeXLSX(workbook);

    // 18. Открываем файл
    fs.openFile(filePath);

    return true;
}

module.exports = { executeScenario1, scenario1 };
