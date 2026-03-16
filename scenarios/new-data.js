/**
 * Сценарий: Новые данные
 * value2 искать в прошлой таблице по name (самые свежие)
 */

const XLSX = require('xlsx');
const fs = require('../modules/filesystem');
const parser = require('../modules/parser');
const merger = require('../modules/merger');
const calculator = require('../modules/calculator');
const prompts = require('../utils/prompts');

async function selectFileAndColumns(fileList, fileNumber, selectTitleAndValue = true) {
    const fileIndex = await prompts.displayMenu(fileList, `Выберите таблицу №${fileNumber}:`);
    const fileName = fileList[fileIndex - 1];
    
    let fileData;
    try {
        fileData = fs.readXLSX(fileName);
    } catch (err) {
        await prompts.showErrorAndWait(err.message);
        process.exit(1);
    }
    
    const { headers, rows } = fileData;
    
    const dateIndex = parser.findDateColumnIndex(headers);
    if (dateIndex === null) {
        await prompts.showErrorAndWait('В файле не найден обязательный столбец "RECDATE"');
        process.exit(1);
    }
    
    console.log(`\nСтолбец RECDATE найден под индексом ${dateIndex + 1}`);
    
    let titleName = 'name';
    let valueName = 'value';
    
    if (selectTitleAndValue) {
        const titleIndex = await prompts.displayMenu(headers, 'Выберите заголовок СОТЫ:');
        const valueIndex = await prompts.displayMenu(headers, 'Выберите заголовок ЗНАЧЕНИЯ:');
        titleName = headers[titleIndex - 1];
        valueName = headers[valueIndex - 1];
    }
    
    const data = parser.extractData(rows, dateIndex, headers.indexOf(titleName), headers.indexOf(valueName));
    
    console.log(`\nДанные извлечены: ${data.length} записей`);
    
    return {
        fileName,
        headers,
        titleName,
        valueName,
        data
    };
}

async function run(files) {
    // 1. Выбираем первую таблицу (для value1)
    const table1 = await selectFileAndColumns(files, 1, true);

    // 2. Получаем уникальные даты и выбираем Точку А и Точку Б
    const uniqueDates = parser.getUniqueDates(table1.data);
    
    if (uniqueDates.length < 2) {
        console.log('ERROR: Найдена только одна уникальная дата. Нужно минимум 2 для сравнения');
        await prompts.waitForEnter();
        process.exit(1);
    }
    
    console.log('\n' + '='.repeat(40));
    console.log('Выберите дату ХОРОШИХ показаний (А):');
    const pointAIndex = await prompts.displayMenu(uniqueDates, 'Дата');
    const pointA = uniqueDates[pointAIndex - 1];
    
    console.log('\n' + '='.repeat(40));
    console.log('Выберите дату ПЛОХИХ показаний (Б):');
    const pointBIndex = await prompts.displayMenu(uniqueDates, 'Дата');
    const pointB = uniqueDates[pointBIndex - 1];
    
    // Определяем какая дата позже
    const [dA, mA, yA, hA, minA] = pointA.split(/[\.: ]/).map(Number);
    const [dB, mB, yB, hB, minB] = pointB.split(/[\.: ]/).map(Number);
    const dateA = new Date(yA < 100 ? 2000 + yA : yA, mA - 1, dA, hA, minA);
    const dateB = new Date(yB < 100 ? 2000 + yB : yB, mB - 1, dB, hB, minB);
    
    const isBLater = dateB > dateA;
    const formulaPoint1 = isBLater ? pointB : pointA;
    const formulaPoint2 = isBLater ? pointA : pointB;
    const formulaDesc = isBLater ? 'А - Б' : 'Б - А';

    console.log(`\n✅ Выбрано: А = ${pointA}, Б = ${pointB}`);
    console.log(`✅ Формула: ${formulaDesc} (А - Б)`);

    // 3. Выбираем вторую таблицу (для value2 - прошлые данные)
    console.log('\n' + '='.repeat(40) + '\n');
    const table2 = await selectFileAndColumns(files, 2, true);

    // 4. Ищем value2 для каждого name (самые свежие данные)
    console.log('\n' + '='.repeat(40));
    console.log(`Поиск самых свежих "${table2.valueName}" по названию...`);
    const value2Lookup = merger.findLatestValue2ByName(table2.data);
    console.log(`Найдено данных: ${value2Lookup.size} записей`);

    // 5. Объединение данных для новых данных
    console.log('\nПостроение сводной таблицы...');

    const { headers, rows } = merger.mergeTablesWithValue2Lookup(
        table1.data,
        table2.data,
        table1.valueName,
        table2.valueName,
        pointA,
        pointB,
        value2Lookup
    );

    console.log(`Уникальных названий: ${rows.length}`);
    console.log(`Столбцов: ${headers.length}`);

    // 6. Вычисление разницы (только Разница Зн.1)
    console.log('\nВычисление разницы...');
    const withDifference = calculator.addDifferenceColumnsForNewData(
        rows,
        headers,
        table1.valueName,
        table2.valueName,
        formulaPoint1,
        formulaPoint2
    );
    console.log(`Добавлены столбцы разницы`);

    // 7. Сортировка по убыванию Б(val2)
    console.log(`\nСортировка данных по "${pointB} (${table2.valueName})"...`);
    const sortedData = calculator.sortByValue2(withDifference, table2.valueName, pointB);
    console.log(`Данные отсортированы по убыванию`);

    // 8. Создание workbook с Листом 1 "Данные"
    const workbook = XLSX.utils.book_new();
    const dataSheet = XLSX.utils.json_to_sheet(sortedData);
    XLSX.utils.book_append_sheet(workbook, dataSheet, 'Данные');

    // 9. Фильтрация отрицательных значений
    console.log('\nФильтрация отрицательных значений...');
    const negative = calculator.filterNegative(sortedData, table1.valueName);
    console.log(`Найдено отрицательных: ${negative.length}`);

    // 10. Создание Листа 2 "Отрицательные"
    const negativeSheet = XLSX.utils.json_to_sheet(negative);
    XLSX.utils.book_append_sheet(workbook, negativeSheet, 'Отрицательные');

    // 11. Топ-10 по Б(val2)
    console.log(`\nПоиск топ-10 по "${pointB} (${table2.valueName})"...`);
    const top10 = calculator.getTop10ByValue2(negative, table2.valueName, pointB);
    console.log(`Топ-10 записей: ${top10.length}`);

    // 12. Создание Листа 3 "Ухудшение"
    const resultSheet = XLSX.utils.json_to_sheet(top10);
    XLSX.utils.book_append_sheet(workbook, resultSheet, 'Ухудшение');

    // 13. Запись в XLSX
    const outputPath = fs.writeXLSX(workbook);
    console.log(`Файл сохранён: ${outputPath}`);

    // 14. Вывод сводки
    console.log('\n' + '='.repeat(40));
    console.log('Обработка завершена успешно!');
    console.log('='.repeat(40));
    console.log(`\nТаблица 1: ${table1.fileName}`);
    console.log(`  Столбец названия: ${table1.titleName}`);
    console.log(`  Столбец значения: ${table1.valueName}`);
    console.log(`  Записей: ${table1.data.length}`);

    console.log(`\nТаблица 2 (${table2.valueName}): ${table2.fileName}`);
    console.log(`  Записей: ${table2.data.length}`);

    console.log(`\nУникальных названий: ${rows.length}`);
    console.log(`Столбцов в результате: ${headers.length}`);
    console.log(`Лист 1 "Данные": ${sortedData.length} записей (отсортировано)`);
    console.log(`Лист 2 "Отрицательные": ${negative.length} записей`);
    console.log(`Лист 3 "Ухудшение": ${top10.length} записей (топ-10 по "${pointB} (${table2.valueName})")`);

    await prompts.waitForEnter();
}

module.exports = { run };
