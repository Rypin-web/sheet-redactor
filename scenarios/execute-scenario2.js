/**
 * Сценарий 2: "Старые данные. Точки в разных таблицах"
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
 * Сценарий 2: массив шагов
 * Поток: Главное меню -> Таблица 1 (Точка А) -> НАЗВАНИЯ -> CCSR -> Rate -> Точка А ->
 *        Таблица 2 (Точка Б) -> НАЗВАНИЯ -> CCSR -> Rate -> Точка Б -> Выполнение
 */
const scenario2 = [
    // Шаг 0: Выбор сценария
    () => steps.chooseScenario(),
    
    // Шаг 1: Выбор первой таблицы (Точка А)
    () => steps.promptTable('table1', 'Укажите таблицу 1 (с данными точки А)'),
    
    // Шаг 2: Выбор заголовка НАЗВАНИЯ для таблицы 1
    () => steps.promptTitle('table1'),
    
    // Шаг 3: Выбор заголовка CCSR для таблицы 1
    () => steps.promptValue1('table1'),
    
    // Шаг 4: Выбор заголовка Rate для таблицы 1
    () => steps.promptValue2('table1'),
    
    // Шаг 5: Выбор даты для точки А
    () => steps.promptPoint('А', 'table1'),
    
    // Шаг 6: Выбор второй таблицы (Точка Б)
    () => steps.promptTable('table2', 'Укажите таблицу 2 (с данными точки Б)'),
    
    // Шаг 7: Выбор заголовка НАЗВАНИЯ для таблицы 2
    () => steps.promptTitle('table2'),
    
    // Шаг 8: Выбор заголовка CCSR для таблицы 2
    () => steps.promptValue1('table2'),
    
    // Шаг 9: Выбор заголовка Rate для таблицы 2
    () => steps.promptValue2('table2'),
    
    // Шаг 10: Выбор даты для точки Б
    () => steps.promptPoint('Б', 'table2'),
    
    // Шаг 11: Выполнение сценария
    executeScenario2
];

/**
 * Извлечь данные из таблицы по параметрам из state
 * @param {string} tableKey - Ключ таблицы в state ('table1', 'table2')
 * @param {string} valueKey - Ключ значения ('value1' для CCSR, 'value2' для Rate)
 * @param {string} point - Точка ('pointA' или 'pointB') - для фильтрации по дате
 * @returns {Array<{date: string, title: string, value: any}>}
 */
function extractDataForPoint(tableKey, valueKey, point) {
    const fileName = state.getStateField(`${tableKey}.file`);
    const titleKey = state.getStateField(`${tableKey}.title`);
    const valueName = state.getStateField(`${tableKey}.${valueKey}`);
    const pointDate = state.getStateField(point);
    
    if (!fileName || !titleKey || !valueName || !pointDate) {
        throw new Error(`Недостаточно данных для ${tableKey}.${valueKey} (${point})`);
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
    
    // Фильтруем по дате точки
    const getDateOnly = (dateTime) => dateTime.split(' ')[0];
    const pointDateOnly = getDateOnly(pointDate);
    
    return allData.filter(item => getDateOnly(item.date) === pointDateOnly);
}

/**
 * Выполнить сценарий 2
 */
async function executeScenario2() {
    console.log('\n[ШАГ ' + state.getStep() + '] === ВЫПОЛНЕНИЕ СЦЕНАРИЯ 2 ===');
    
    // Получаем данные из state
    const pointA = state.getStateField('pointA');
    const pointB = state.getStateField('pointB');
    const ccsrName = state.getStateField('table1.value1');
    const rateName = state.getStateField('table1.value2');
    
    console.log(`\nПараметры:`);
    console.log(`  Точка А: ${pointA} (Таблица 1)`);
    console.log(`  Точка Б: ${pointB} (Таблица 2)`);
    console.log(`  CCSR столбец: ${ccsrName}`);
    console.log(`  Rate столбец: ${rateName}`);
    
    // 1. Извлекаем данные из таблиц для каждой точки
    console.log('\nИзвлечение данных из таблиц...');
    
    // Таблица 1: CCSR и Rate для точки А
    const ccsrDataA = extractDataForPoint('table1', 'value1', 'pointA');
    const rateDataA = extractDataForPoint('table1', 'value2', 'pointA');
    console.log(`  Таблица 1 (Точка А): CCSR=${ccsrDataA.length}, Rate=${rateDataA.length}`);
    
    // Таблица 2: CCSR и Rate для точки Б
    const ccsrDataB = extractDataForPoint('table2', 'value1', 'pointB');
    const rateDataB = extractDataForPoint('table2', 'value2', 'pointB');
    console.log(`  Таблица 2 (Точка Б): CCSR=${ccsrDataB.length}, Rate=${rateDataB.length}`);
    
    // 2. Объединяем данные в сводную таблицу
    console.log('\nПостроение сводной таблицы...');
    
    // Группируем данные по названию
    const groupedCcsrA = new Map(ccsrDataA.map(item => [item.title, item.value]));
    const groupedCcsrB = new Map(ccsrDataB.map(item => [item.title, item.value]));
    const groupedRateA = new Map(rateDataA.map(item => [item.title, item.value]));
    const groupedRateB = new Map(rateDataB.map(item => [item.title, item.value]));
    
    // Собираем все уникальные названия
    const allTitles = new Set([
        ...groupedCcsrA.keys(),
        ...groupedCcsrB.keys(),
        ...groupedRateA.keys(),
        ...groupedRateB.keys()
    ]);
    const sortedTitles = Array.from(allTitles).sort();
    
    // Формируем заголовки
    const headers = ['Название'];
    headers.push(`${pointA} (${ccsrName})`);
    headers.push(`${pointB} (${ccsrName})`);
    headers.push(`${pointA} (${rateName})`);
    headers.push(`${pointB} (${rateName})`);
    
    // Формируем строки
    const rows = [];
    for (const title of sortedTitles) {
        const row = {
            'Название': title,
            [`${pointA} (${ccsrName})`]: groupedCcsrA.get(title) ?? '',
            [`${pointB} (${ccsrName})`]: groupedCcsrB.get(title) ?? '',
            [`${pointA} (${rateName})`]: groupedRateA.get(title) ?? '',
            [`${pointB} (${rateName})`]: groupedRateB.get(title) ?? ''
        };
        rows.push(row);
    }
    
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
        true  // useAbsoluteRate = true (модуль для Rate)
    );
    console.log('  Добавлены столбцы: Разница (CCSR), Разница (Rate) [с модулем]');
    
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
    
    // 12. Вывод сводки
    console.log('\n' + '='.repeat(50));
    console.log('✅ Обработка завершена успешно!');
    console.log('='.repeat(50));
    console.log(`\nТаблица 1 (Точка А): ${state.getStateField('table1.file')}`);
    console.log(`  Столбец названия: ${state.getStateField('table1.title')}`);
    console.log(`  Столбец CCSR: ${ccsrName}`);
    console.log(`  Столбец Rate: ${rateName}`);
    console.log(`  Точка А: ${pointA}`);
    
    console.log(`\nТаблица 2 (Точка Б): ${state.getStateField('table2.file')}`);
    console.log(`  Столбец названия: ${state.getStateField('table2.title')}`);
    console.log(`  Столбец CCSR: ${ccsrName}`);
    console.log(`  Столбец Rate: ${rateName}`);
    console.log(`  Точка Б: ${pointB}`);
    
    console.log(`\nРезультат:`);
    console.log(`  Уникальных названий: ${rows.length}`);
    console.log(`  Столбцов: ${headers.length}`);
    console.log(`  Лист 1 "Данные": ${sortedData.length} записей`);
    console.log(`  Лист 2 "Отрицательные": ${negative.length} записей`);
    console.log(`  Лист 3 "Ухудшение": ${top10.length} записей`);
    console.log('='.repeat(50));
    
    return true;
}

module.exports = { executeScenario2, scenario2 };
