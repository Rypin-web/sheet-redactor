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
    () => steps.promptTable('table2', 'Выберите таблицу 2 (с ВЕСОМ сот)'),
    
    // Шаг 8: Выбор заголовка НАЗВАНИЯ для таблицы 2
    () => steps.promptTitle('table2'),
    
    // Шаг 9: Выбор заголовка Rate для таблицы 2
    () => steps.promptValue2('table2'),
    
    // Шаг 10: Выполнение сценария
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

    // 8. Топ-10 по Разница (Rate)
    const top10 = calculator.getTop10ByDifferenceRate(negative, rateName);

    // 9. Создаём лист "Ухудшение"
    const resultSheet = XLSX.utils.json_to_sheet(top10);
    XLSX.utils.book_append_sheet(workbook, resultSheet, 'ТОП-10');

    // 10. Записываем в файл
    const { filePath, filename } = fs.writeXLSX(workbook);

    // 11. Открываем файл
    fs.openFile(filePath);

    return true;
}

module.exports = { executeScenario1, scenario1 };
