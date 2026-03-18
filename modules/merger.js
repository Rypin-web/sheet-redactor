/**
 * Модуль объединения данных
 * Отвечает за: группировку по датам и названиям, построение сводной таблицы
 */

/**
 * Сгруппировать данные по названию и дате
 * @param {Array<{date: string, title: string, value: any}>} data - Массив записей
 * @returns {Map<string, Map<string, any>>} Map: название → (Map: дата → значение)
 */
function groupByTitleAndDate(data) {
    const grouped = new Map();
    
    for (const item of data) {
        const { date, title, value } = item;
        
        if (!grouped.has(title)) {
            grouped.set(title, new Map());
        }
        
        grouped.get(title).set(date, value);
    }
    
    return grouped;
}

/**
 * Объединить данные из двух таблиц и построить сводную таблицу
 * Создаёт столбцы ТОЛЬКО для выбранных дат (pointA и pointB)
 * 
 * @param {Array<{date: string, title: string, value: any}>} data1 - Данные первой таблицы
 * @param {Array<{date: string, title: string, value: any}>} data2 - Данные второй таблицы
 * @param {string} valueName1 - Название столбца значений из таблицы 1
 * @param {string} valueName2 - Название столбца значений из таблицы 2
 * @param {string} pointA - Дата точки А (DD.MM.YY HH:MM)
 * @param {string} pointB - Дата точки Б (DD.MM.YY HH:MM)
 * @returns {{headers: string[], rows: any[]}} Заголовки и строки для XLSX
 */
function mergeTables(data1, data2, valueName1, valueName2, pointA, pointB) {
    // Группируем данные по названию и дате
    const grouped1 = groupByTitleAndDate(data1);
    const grouped2 = groupByTitleAndDate(data2);

    // Собираем все уникальные названия из обеих таблиц
    const allTitles = new Set([...grouped1.keys(), ...grouped2.keys()]);

    // Сортируем названия по алфавиту
    const sortedTitles = Array.from(allTitles).sort();

    // Извлекаем только дату (без времени) для сравнения
    const getDateOnly = (dateTime) => dateTime.split(' ')[0]; // '17.02.24 10:00' -> '17.02.24'
    const pointADate = getDateOnly(pointA);
    const pointBDate = getDateOnly(pointB);

    // Формируем заголовки - ТОЛЬКО для выбранных точек А и Б
    const headers = ['Название'];
    headers.push(`${pointA} (${valueName1})`);
    headers.push(`${pointB} (${valueName1})`);
    headers.push(`${pointA} (${valueName2})`);
    headers.push(`${pointB} (${valueName2})`);

    // Формируем строки
    const rows = [];

    for (const title of sortedTitles) {
        const row = { 'Название': title };

        const dataForTitle1 = grouped1.get(title) || new Map();
        const dataForTitle2 = grouped2.get(title) || new Map();

        // Ищем значения для точки А и Б в таблице 1 (точное совпадение)
        let valA1 = dataForTitle1.get(pointA);
        let valB1 = dataForTitle1.get(pointB);
        
        // Если не найдено, ищем по дате без времени
        if (valA1 === undefined) {
            for (const [date, value] of dataForTitle1.entries()) {
                if (getDateOnly(date) === pointADate) {
                    valA1 = value;
                    break;
                }
            }
        }
        if (valB1 === undefined) {
            for (const [date, value] of dataForTitle1.entries()) {
                if (getDateOnly(date) === pointBDate) {
                    valB1 = value;
                    break;
                }
            }
        }

        // Ищем значения для точки А и Б в таблице 2 (сначала точное, потом по дате)
        let valA2 = dataForTitle2.get(pointA);
        let valB2 = dataForTitle2.get(pointB);
        
        if (valA2 === undefined) {
            for (const [date, value] of dataForTitle2.entries()) {
                if (getDateOnly(date) === pointADate) {
                    valA2 = value;
                    break;
                }
            }
        }
        if (valB2 === undefined) {
            for (const [date, value] of dataForTitle2.entries()) {
                if (getDateOnly(date) === pointBDate) {
                    valB2 = value;
                    break;
                }
            }
        }

        // Добавляем значения
        row[`${pointA} (${valueName1})`] = valA1 ?? '';
        row[`${pointB} (${valueName1})`] = valB1 ?? '';
        row[`${pointA} (${valueName2})`] = valA2 ?? '';
        row[`${pointB} (${valueName2})`] = valB2 ?? '';

        rows.push(row);
    }

    return { headers, rows };
}

/**
 * Найти value2 для каждого name из Таблицы 2
 * Берёт самые свежие данные (максимальная дата)
 * 
 * @param {Array<{date: string, title: string, value: any}>} data2 - Данные Таблицы 2
 * @returns {Map<string, any>} Map: name → value2 (самые свежие)
 */
function findLatestValue2ByName(data2) {
    const grouped = new Map(); // name → {date, value}
    
    for (const item of data2) {
        const { date, title, value } = item;
        
        const existing = grouped.get(title);
        
        if (!existing) {
            // Первое значение для этого name
            grouped.set(title, { date, value });
        } else {
            // Сравниваем даты - берём более свежую
            const existingDate = parseDateForComparison(existing.date);
            const newDate = parseDateForComparison(date);
            
            if (newDate > existingDate) {
                grouped.set(title, { date, value });
            }
        }
    }
    
    // Возвращаем только value
    const result = new Map();
    for (const [name, data] of grouped.entries()) {
        result.set(name, data.value);
    }
    
    return result;
}

/**
 * Парсить дату для сравнения (возвращает timestamp)
 * @param {string} dateTime - Дата в формате DD.MM.YY HH:MM
 * @returns {number} Timestamp
 */
function parseDateForComparison(dateTime) {
    const [d, m, y, h, min] = dateTime.split(/[\.: ]/).map(Number);
    return new Date(y < 100 ? 2000 + y : y, m - 1, d, h || 0, min || 0).getTime();
}

/**
 * Объединить данные для сценария "Новые данные"
 * value2 берётся из lookup таблицы (самые свежие по name)
 * Для точки А ищем по дате, для точки Б — самые свежие
 * 
 * @param {any[]} data1 - Данные Таблицы 1
 * @param {any[]} data2 - Данные Таблицы 2 (для value2)
 * @param {string} valueName1 - Название столбца значений из Таблицы 1
 * @param {string} valueName2 - Название столбца значений из Таблицы 2
 * @param {string} pointA - Дата точки А
 * @param {string} pointB - Дата точки Б
 * @param {Map<string, any>} value2Lookup - Map: name → value2 (самые свежие для Б)
 * @returns {{headers: string[], rows: any[]}}
 */
function mergeTablesWithValue2Lookup(data1, data2, valueName1, valueName2, pointA, pointB, value2Lookup) {
    // Группируем данные Таблицы 1 по названию и дате
    const grouped1 = groupByTitleAndDate(data1);
    
    // Группируем данные Таблицы 2 по названию и дате (для поиска А(val2))
    const grouped2 = groupByTitleAndDate(data2);
    
    // Собираем все названия
    const allTitles = new Set(grouped1.keys());
    const sortedTitles = Array.from(allTitles).sort();
    
    // Извлекаем только дату (без времени) для сравнения
    const getDateOnly = (dateTime) => dateTime.split(' ')[0];
    const pointADate = getDateOnly(pointA);
    const pointBDate = getDateOnly(pointB);
    
    // Формируем заголовки
    const headers = ['Название'];
    headers.push(`${pointA} (${valueName1})`);
    headers.push(`${pointB} (${valueName1})`);
    headers.push(`${pointA} (${valueName2})`); // А(val2) - по дате
    headers.push(`${pointB} (${valueName2})`); // Б(val2) - самые свежие
    headers.push(`Разница (${valueName1})`);
    
    // Формируем строки
    const rows = [];
    
    for (const title of sortedTitles) {
        const row = { 'Название': title };
        
        const dataForTitle1 = grouped1.get(title) || new Map();
        const dataForTitle2 = grouped2.get(title) || new Map();
        
        // Ищем значения для точек А и Б в Таблице 1 (с поиском по дате)
        let valA1 = findValueByDate(dataForTitle1, pointA, pointADate);
        let valB1 = findValueByDate(dataForTitle1, pointB, pointBDate);
        
        // Ищем А(val2) по дате (точное совпадение или по дате без времени)
        let valA2 = findValueByDate(dataForTitle2, pointA, pointADate);
        
        // Б(val2) берём из lookup таблицы (самые свежие)
        const valB2 = value2Lookup.get(title) ?? '';

        // Считаем Разница Зн.1: А - Б (ранняя - поздняя)
        const diff1 = (valA1 ?? 0) - (valB1 ?? 0);
        
        // Добавляем значения
        row[`${pointA} (${valueName1})`] = valA1 ?? '';
        row[`${pointB} (${valueName1})`] = valB1 ?? '';
        row[`${pointA} (${valueName2})`] = valA2 ?? '';
        row[`${pointB} (${valueName2})`] = valB2;
        row[`Разница (${valueName1})`] = diff1;
        
        rows.push(row);
    }
    
    return { headers, rows };
}

/**
 * Найти значение по дате (сначала точное совпадение, потом по дате без времени)
 * @param {Map<string, any>} dataMap - Map: date → value
 * @param {string} point - Точная дата (DD.MM.YY HH:MM)
 * @param {string} pointDate - Только дата (DD.MM.YY)
 * @returns {any} Значение или undefined
 */
function findValueByDate(dataMap, point, pointDate) {
    // Сначала ищем точное совпадение
    let value = dataMap.get(point);

    if (value === undefined) {
        // Если не найдено, ищем по дате без времени
        for (const [date, val] of dataMap.entries()) {
            if (date.split(' ')[0] === pointDate) {
                value = val;
                break;
            }
        }
    }

    return value;
}

/**
 * Объединить данные для сценария 1 "Старые данные. Обе точки в одной таблице"
 * Таблица 1: CCSR для точек А и Б
 * Таблица 2: Rate для точек А и Б
 *
 * @param {any[]} data1 - Данные Таблицы 1 (CCSR)
 * @param {any[]} data2 - Данные Таблицы 2 (Rate)
 * @param {string} ccsrName - Название столбца CCSR
 * @param {string} rateName - Название столбца Rate
 * @param {string} pointA - Дата точки А
 * @param {string} pointB - Дата точки Б
 * @returns {{headers: string[], rows: any[]}}
 */
function mergeTablesScenario1(data1, data2, ccsrName, rateName, pointA, pointB) {
    // Группируем данные по названию и дате
    const grouped1 = groupByTitleAndDate(data1);  // CCSR
    const grouped2 = groupByTitleAndDate(data2);  // Rate

    // Собираем все уникальные названия из обеих таблиц
    const allTitles = new Set([...grouped1.keys(), ...grouped2.keys()]);
    const sortedTitles = Array.from(allTitles).sort();

    // Извлекаем только дату (без времени) для сравнения
    const getDateOnly = (dateTime) => dateTime.split(' ')[0];
    const pointADate = getDateOnly(pointA);
    const pointBDate = getDateOnly(pointB);

    // Формируем заголовки
    const headers = ['Название'];
    headers.push(`${pointA} (${ccsrName})`);
    headers.push(`${pointB} (${ccsrName})`);
    headers.push(`${pointA} (${rateName})`);
    headers.push(`${pointB} (${rateName})`);

    // Формируем строки
    const rows = [];

    for (const title of sortedTitles) {
        const row = { 'Название': title };

        const dataForTitle1 = grouped1.get(title) || new Map();  // CCSR
        const dataForTitle2 = grouped2.get(title) || new Map();  // Rate

        // Ищем CCSR для точек А и Б (с поиском по дате)
        let ccsrA = findValueByDate(dataForTitle1, pointA, pointADate);
        let ccsrB = findValueByDate(dataForTitle1, pointB, pointBDate);

        // Ищем Rate для точек А и Б (с поиском по дате)
        let rateA = findValueByDate(dataForTitle2, pointA, pointADate);
        let rateB = findValueByDate(dataForTitle2, pointB, pointBDate);

        // Добавляем значения
        row[`${pointA} (${ccsrName})`] = ccsrA ?? '';
        row[`${pointB} (${ccsrName})`] = ccsrB ?? '';
        row[`${pointA} (${rateName})`] = rateA ?? '';
        row[`${pointB} (${rateName})`] = rateB ?? '';

        rows.push(row);
    }

    return { headers, rows };
}

/**
 * Объединить данные для сценария 3 "Новые данные. Точки в одной таблице"
 * Таблица 1: CCSR для точек А и Б
 * Таблица 2: Rate — самые свежие по name (lookup)
 *
 * @param {any[]} data1 - Данные Таблицы 1 (CCSR для точек А и Б)
 * @param {any[]} data2 - Данные Таблицы 2 (Rate для lookup)
 * @param {string} ccsrName - Название столбца CCSR
 * @param {string} rateName - Название столбца Rate
 * @param {string} pointA - Дата точки А
 * @param {string} pointB - Дата точки Б
 * @param {Map<string, any>} rateLookup - Map: name → Rate (самые свежие)
 * @returns {{headers: string[], rows: any[]}}
 */
function mergeTablesScenario3(data1, data2, ccsrName, rateName, pointA, pointB, rateLookup) {
    // Группируем данные Таблицы 1 по названию и дате
    const grouped1 = groupByTitleAndDate(data1);

    // Собираем все уникальные названия из Таблицы 1
    const allTitles = new Set(grouped1.keys());
    const sortedTitles = Array.from(allTitles).sort();

    // Извлекаем только дату (без времени) для сравнения
    const getDateOnly = (dateTime) => dateTime.split(' ')[0];
    const pointADate = getDateOnly(pointA);
    const pointBDate = getDateOnly(pointB);

    // Формируем заголовки
    const headers = ['Название'];
    headers.push(`${pointA} (${ccsrName})`);
    headers.push(`${pointB} (${ccsrName})`);
    headers.push(`Разница (${ccsrName})`);
    headers.push(`${rateName}`);

    // Формируем строки
    const rows = [];

    for (const title of sortedTitles) {
        const row = { 'Название': title };

        const dataForTitle1 = grouped1.get(title) || new Map();

        // Ищем CCSR для точек А и Б (с поиском по дате)
        let ccsrA = findValueByDate(dataForTitle1, pointA, pointADate);
        let ccsrB = findValueByDate(dataForTitle1, pointB, pointBDate);

        // Rate берём из lookup таблицы (самые свежие)
        const rate = rateLookup.get(title) ?? '';

        // Добавляем значения
        row[`${pointA} (${ccsrName})`] = ccsrA ?? '';
        row[`${pointB} (${ccsrName})`] = ccsrB ?? '';
        row[`${rateName}`] = rate;

        rows.push(row);
    }

    return { headers, rows };
}

module.exports = {
    mergeTables,
    mergeTablesWithValue2Lookup,
    mergeTablesScenario1,
    mergeTablesScenario3,
    findLatestValue2ByName,
};
