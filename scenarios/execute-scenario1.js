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
    () => steps.promptTable('table1', 'Укажите таблицу 1 (с данными точек А и Б)'),
    
    // Шаг 2: Выбор заголовка НАЗВАНИЯ для таблицы 1
    () => steps.promptTitle('table1'),
    
    // Шаг 3: Выбор заголовка CCSR для таблицы 1
    () => steps.promptValue1('table1'),

    // Шаг 5: Выбор даты для точки А
    () => steps.promptPoint('А', 'table1'),
    
    // Шаг 6: Выбор даты для точки Б
    () => steps.promptPoint('Б', 'table1'),
    
    // Шаг 7: Выбор второй таблицы
    () => steps.promptTable('table2', 'Укажите таблицу 2 (с данными для Rate)'),
    
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
    console.log('\n[ШАГ ' + state.getStep() + '] === ВЫПОЛНЕНИЕ СЦЕНАРИЯ 1 ===');
    
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
    console.log('\nИзвлечение данных из таблиц...');
    const data1 = extractDataFromTable('table1', 'value1');  // CCSR из Таблицы 1
    const data2 = extractDataFromTable('table2', 'value2');  // Rate из Таблицы 2
    console.log(`  Таблица 1 (CCSR): ${data1.length} записей`);
    console.log(`  Таблица 2 (Rate): ${data2.length} записей`);
    
    // 2. Объединяем данные в сводную таблицу
    console.log('\nПостроение сводной таблицы...');
    const { headers, rows } = merger.mergeTablesScenario1(
        data1,
        data2,
        ccsrName,
        rateName,
        pointA,
        pointB
    );
    console.log(`  Уникальных названий: ${rows.length}`);
    console.log(`  Столбцов: ${headers.length}`);
    
    // 3. Вычисляем разницу (Б - А)
    console.log('\nВычисление разницы (Б - А)...');
    const withDifference = calculator.addDifferenceColumnsScenario1(
        rows,
        ccsrName,
        rateName,
        pointA,
        pointB,
      true
    );
    console.log('  Добавлены столбцы: Разница (CCSR), Разница (Rate)');
    
    // 4. Сортируем по убыванию Разница (Rate)
    console.log('\nСортировка по убыванию "Разница (Rate)"...');
    const sortedData = calculator.sortByDifferenceRate(withDifference, rateName);
    console.log('  Данные отсортированы');
    
    // 5. Создаём workbook с листом "Данные"
    const workbook = XLSX.utils.book_new();
    const dataSheet = XLSX.utils.json_to_sheet(sortedData);
    XLSX.utils.book_append_sheet(workbook, dataSheet, 'Данные');
    console.log('\nЛист 1 "Данные": создан');
    
    // 6. Фильтруем отрицательные по Разница (CCSR)
    console.log('\nФильтрация отрицательных по "Разница (CCSR)"...');
    const negative = calculator.filterNegativeByCcsr(sortedData, ccsrName);
    console.log(`  Найдено отрицательных: ${negative.length}`);
    
    // 7. Создаём лист "Отрицательные"
    const negativeSheet = XLSX.utils.json_to_sheet(negative);
    XLSX.utils.book_append_sheet(workbook, negativeSheet, 'Отрицательные');
    console.log('Лист 2 "Отрицательные": создан');
    
    // 8. Топ-10 по Разница (Rate)
    console.log('\nПоиск топ-10 по "Разница (Rate)"...');
    const top10 = calculator.getTop10ByDifferenceRate(negative, rateName);
    console.log(`  Топ-10 записей: ${top10.length}`);
    
    // 9. Создаём лист "Ухудшение"
    const resultSheet = XLSX.utils.json_to_sheet(top10);
    XLSX.utils.book_append_sheet(workbook, resultSheet, 'Ухудшение');
    console.log('Лист 3 "Ухудшение": создан');
    
    // 10. Записываем в файл
    console.log('\nСохранение файла...');
    const { filePath, filename } = fs.writeXLSX(workbook);
    console.log(`  Файл сохранён: ${filename}`);
    
    // 11. Открываем файл
    console.log('\nОткрытие файла...');
    fs.openFile(filePath);
    console.log('  Файл открыт в Excel');
    
    // 11. Вывод сводки
    console.log('\n' + '='.repeat(50));
    console.log('✅ Обработка завершена успешно!');
    console.log('='.repeat(50));
    console.log(`\nТаблица 1: ${state.getStateField('table1.file')}`);
    console.log(`  Столбец названия: ${state.getStateField('table1.title')}`);
    console.log(`  Столбец CCSR: ${ccsrName}`);
    console.log(`  Записей: ${data1.length}`);
    
    console.log(`\nТаблица 2: ${state.getStateField('table2.file')}`);
    console.log(`  Столбец названия: ${state.getStateField('table2.title')}`);
    console.log(`  Столбец Rate: ${rateName}`);
    console.log(`  Записей: ${data2.length}`);
    
    console.log(`\nТочки:`);
    console.log(`  А: ${pointA}`);
    console.log(`  Б: ${pointB}`);
    
    console.log(`\nРезультат:`);
    console.log(`  Уникальных названий: ${rows.length}`);
    console.log(`  Столбцов: ${headers.length}`);
    console.log(`  Лист 1 "Данные": ${sortedData.length} записей`);
    console.log(`  Лист 2 "Отрицательные": ${negative.length} записей`);
    console.log(`  Лист 3 "Ухудшение": ${top10.length} записей`);
    console.log('='.repeat(50));
    
    return true;
}

module.exports = { executeScenario1, scenario1 };
