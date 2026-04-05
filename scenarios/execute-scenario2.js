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
const additionalColumnsProcessor = require('../utils/additional-columns-processor');
const alarmProcessor = require('../utils/alarm-processor');
const bsSvodProcessor = require('../utils/bs-svod-processor');
const bsCellsProcessor = require('../utils/bs-cells-processor');
const svodAlarmProcessor = require('../utils/svod-alarm-processor');

/**
 * Сценарий 2: массив шагов
 * Поток: Главное меню -> Таблица 1 (Точка А) -> НАЗВАНИЯ -> CCSR -> Rate -> Точка А ->
 *        Таблица 2 (Точка Б) -> НАЗВАНИЯ -> CCSR -> Rate -> Точка Б -> Выполнение
 */
const scenario2 = [
    // Шаг 0: Выбор сценария
    () => steps.chooseScenario(),
    
    // Шаг 1: Выбор первой таблицы (Точка А)
    () => steps.promptTable('table1', 'Выберите таблицу 1 (с данными точки А)'),
    
    // Шаг 2: Выбор заголовка НАЗВАНИЯ для таблицы 1
    () => steps.promptTitle('table1'),
    
    // Шаг 3: Выбор заголовка CCSR для таблицы 1
    () => steps.promptValue1('table1'),
    
    // Шаг 4: Выбор заголовка Rate для таблицы 1
    () => steps.promptValue2('table1'),
    
    // Шаг 5: Выбор даты для точки А
    () => steps.promptPoint('А', 'table1'),
    
    // Шаг 6: Выбор второй таблицы (Точка Б)
    () => steps.promptTable('table2', 'Выберите таблицу 2 (с данными точки Б)'),
    
    // Шаг 7: Выбор заголовка НАЗВАНИЯ для таблицы 2
    () => steps.promptTitle('table2'),
    
    // Шаг 8: Выбор заголовка CCSR для таблицы 2
    () => steps.promptValue1('table2'),
    
    // Шаг 9: Выбор заголовка Rate для таблицы 2
    () => steps.promptValue2('table2'),
    
    // Шаг 10: Выбор даты для точки Б
    () => steps.promptPoint('Б', 'table2'),

    // Шаг 11: Выбор дополнительных столбцов
    () => steps.promptAdditionalColumns(),

    // Шаг 12: Выбор alarm-table для точки A
    () => steps.promptAlarmTable('A'),
    // Шаг 13: Выбор alarm-table для точки B
    () => steps.promptAlarmTable('B'),

    // Шаг 14: Выполнение сценария
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
    console.log('\n=== ВЫПОЛНЕНИЕ СЦЕНАРИЯ 2 ===');
    
    // Получаем данные из state
    const pointA = state.getStateField('pointA');
    const pointB = state.getStateField('pointB');
    const ccsrName = state.getStateField('table1.value1');
    const rateName = state.getStateField('table1.value2');

    console.log(`\nПараметры:`);
    console.log(`  Точка А: ${pointA} (Таблица 1)`);
    console.log(`  CCSR столбец: ${ccsrName}`);
    console.log(`  Rate столбец: ${rateName}`);
    console.log(`  Точка Б: ${pointB} (Таблица 2)`);
    console.log(`  CCSR столбец: ${ccsrName}`);
    console.log(`  Rate столбец: ${rateName}`);

    // 1. Извлекаем данные из таблиц для каждой точки

    // Таблица 1: CCSR и Rate для точки А
    const ccsrDataA = extractDataForPoint('table1', 'value1', 'pointA');
    console.log('KPI из первой таблицы: ', ccsrDataA.length)
    const rateDataA = extractDataForPoint('table1', 'value2', 'pointA');
    console.log('ВЕС из первой таблицы: ', rateDataA.length)
    // Таблица 2: CCSR и Rate для точки Б
    const ccsrDataB = extractDataForPoint('table2', 'value1', 'pointB');
    console.log('KPI из второй таблицы: ', ccsrDataB.length)
    const rateDataB = extractDataForPoint('table2', 'value2', 'pointB');
    console.log('ВЕС из второй таблицы: ', rateDataB.length)

    // 2. Объединяем данные в сводную таблицу

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
    

    // 3. Вычисляем разницу (Б - А)
    const withDifference = calculator.addDifferenceColumnsScenario1(
        rows,
        ccsrName,
        rateName,
        pointA,
        pointB,
    );

    // 4. Сортируем по убыванию Изменение (Rate)
    const sortedData = calculator.sortByDifferenceRate(withDifference, rateName);

    // 5. Создаём workbook с листом "Данные"
    const workbook = XLSX.utils.book_new();
    const dataSheet = XLSX.utils.json_to_sheet(sortedData);
    XLSX.utils.book_append_sheet(workbook, dataSheet, 'Исходные данные');

    // 6. Фильтруем отрицательные по Изменение (CCSR)
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

    // 13. Топ-10 по Изменение (Rate) (из обновлённых данных)
    const top10 = calculator.getTop10ByDifferenceRate(updatedNegative, rateName);

    // 14. Пересоздаём лист "ТОП-10" с обновлёнными данными
    const allHeaders = Object.keys(top10[0]);
    const resultSheet = XLSX.utils.json_to_sheet(top10, { header: allHeaders });
    XLSX.utils.book_append_sheet(workbook, resultSheet, 'ТОП-10');

    // 15. Обрабатываем статистику по БС (добавляем мини-таблицу на "ТОП-10")
    // Для сценария 2 объединяем данные из обеих таблиц
    const table1Data = extractDataForPoint('table1', 'value1', 'pointA');
    const table2Data = extractDataForPoint('table2', 'value1', 'pointB');
    const combinedData = [...table1Data, ...table2Data];
    bsCellsProcessor.processBsCellsStats(workbook, combinedData);

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

module.exports = { executeScenario2, scenario2 };
