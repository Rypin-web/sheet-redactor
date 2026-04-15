/**
 * Модуль подсчёта пострадавших сот на БС
 * Добавляет мини-таблицу на лист "ТОП-10" (начиная со строки 13)
 */

const XLSX = require('xlsx');
const state = require('./state');

/**
 * Извлечь префикс соты (часть до "_") для поиска в Таблице 1
 * @param {string} cellName - Полное имя соты (например, "MK4123_02")
 * @returns {string} Префикс соты (например, "MK4123")
 */
function extractCellPrefix(cellName) {
    if (!cellName) return '';
    
    // Берём часть до "_"
    const prefix = cellName.split('_')[0];
    return prefix;
}

/**
 * Считать количество уникальных сот с данным префиксом в Таблице 1
 * Учитывает только уникальные названия сот (игнорирует повторения по датам)
 * @param {Array<{date: string, title: string, value: any}>} table1Data - Данные Таблицы 1
 * @param {string} cellPrefix - Префикс соты (например, "MK4123")
 * @returns {number} Количество уникальных сот
 */
function countCellsInTable1(table1Data, cellPrefix) {
    if (!table1Data || !cellPrefix) return 0;

    // Собираем уникальные названия сот с данным префиксом
    const uniqueCells = new Set();
    for (const item of table1Data) {
        if (item.title && item.title.includes(cellPrefix)) {
            uniqueCells.add(item.title);
        }
    }

    return uniqueCells.size;
}

/**
 * Обработать статистику по БС и добавить мини-таблицу на лист "ТОП-10"
 * Берём БС из ТОП-10, считаем соты в "Ухудшились"
 * @param {object} workbook - Workbook объект SheetJS (созданный, но не сохранённый)
 * @param {Array<{date: string, title: string, value: any}>} table1Data - Данные Таблицы 1
 */
function processBsCellsStats(workbook, table1Data) {
    // 1. Получить лист "ТОП-10" (берём список БС оттуда)
    const top10Sheet = workbook.Sheets['ТОП-10'];
    if (!top10Sheet) {
        console.error('❌ Лист "ТОП-10" не найден');
        return;
    }

    // 2. Получить лист "Ухудшились" (считаем соты по нему)
    const sourceSheet = workbook.Sheets['Ухудшились'];
    if (!sourceSheet) {
        console.error('❌ Лист "Ухудшились" не найден');
        return;
    }

    // 3. Преобразуем лист "ТОП-10" в массив объектов (берём БС отсюда)
    const top10Data = XLSX.utils.sheet_to_json(top10Sheet);

    if (top10Data.length === 0) {
        console.log('  Лист "ТОП-10" пуст, пропускаем обработку');
        return;
    }

    // 4. Преобразуем лист "Ухудшились" в массив объектов (считаем соты отсюда)
    const sourceData = XLSX.utils.sheet_to_json(sourceSheet);

    if (sourceData.length === 0) {
        console.log('  Лист "Ухудшились" пуст, пропускаем обработку');
        return;
    }

    console.log(`  Обработка ${top10Data.length} БС из ТОП-10...`);
    console.log(`  Подсчёт сот по ${sourceData.length} записям из "Ухудшились"...`);
    
    // 5. Извлечь уникальные БС из листа "ТОП-10"
    const uniqueBsSet = new Set();
    for (const row of top10Data) {
        if (row['БС']) {
            uniqueBsSet.add(row['БС']);
        }
    }
    const uniqueBsList = Array.from(uniqueBsSet).sort();

    // 6. Для каждой БС из ТОП-10 найти соответствующие соты в "Ухудшились"
    const bsToCellsMap = new Map();  // БС → Set<полные имена сот>

    for (const row of sourceData) {
        const bsName = row['БС'];
        const fullName = row['Название'];

        if (!bsName || !fullName) continue;

        // Добавляем соту только если её БС есть в ТОП-10
        if (uniqueBsSet.has(bsName)) {
            if (!bsToCellsMap.has(bsName)) {
                bsToCellsMap.set(bsName, new Set());
            }
            bsToCellsMap.get(bsName).add(fullName);
        }
    }

    // 7. Для каждой БС из ТОП-10 посчитать статистику
    let stats = [];

    for (const bsName of uniqueBsList) {
        const cellsInSource = bsToCellsMap.get(bsName);
        const sourceCount = cellsInSource ? cellsInSource.size : 0;

        // Берём любую соту из ТОП-10 для этой БС
        const anyTop10Cell = top10Data.find(row => row['БС'] === bsName);
        const anyCell = anyTop10Cell ? anyTop10Cell['Название'] : null;

        if (!anyCell) continue;

        // Извлекаем префикс соты (для поиска в Таблице 1)
        const cellPrefix = extractCellPrefix(anyCell);

        // Считаем количество сот с этим префиксом в Таблице 1
        const totalInTable1 = countCellsInTable1(table1Data, cellPrefix);

        // Сравниваем: если все соты из Таблицы 1 попали в "Ухудшились"
        const result = (totalInTable1 === sourceCount) ? 'ВСЕ' : sourceCount;

        stats.push({
            'БС': bsName,
            'Пострадавших сот': result,
            '_sortValue': result === 'ВСЕ' ? Infinity : sourceCount  // Для сортировки
        });

    }

    // Сортировка: "ВСЕ" вверху, затем по убыванию числа
    stats.sort((a, b) => {
        return b._sortValue - a._sortValue;
    });

    // Удаляем служебное поле _sortValue
    stats = stats.map(s => ({
        'БС': s['БС'],
        'Пострадавших сот': s['Пострадавших сот']
    }));
    
    // 6. Добавить мини-таблицу на лист "ТОП-10"
    console.log('  Запись мини-таблицы на лист "ТОП-10"...');

    // Строка 13: заголовки
    top10Sheet['A13'] = { v: 'БС', t: 's' };
    top10Sheet['B13'] = { v: 'Пострадавших сот', t: 's' };

    // Строки 14+: данные
    for (let i = 0; i < stats.length; i++) {
        const row = 14 + i;
        top10Sheet[`A${row}`] = { v: stats[i]['БС'], t: 's' };
        top10Sheet[`B${row}`] = { v: stats[i]['Пострадавших сот'], t: typeof stats[i]['Пострадавших сот'] === 'string' ? 's' : 'n' };
    }

    // Обновить диапазон листа (динамически с учётом дополнительных столбцов)
    const lastRow = 13 + stats.length;
    const additionalColumns = state.getStateField('additionalColumns') || [];
    const baseCols = 8; // A-H (базовые столбцы)
    // Каждый дополнительный столбец теперь даёт 2 столбца (было/стало)
    const totalCols = baseCols + additionalColumns.length * 2;
    const lastColLetter = String.fromCharCode(65 + totalCols - 1); // 65 = 'A'
    top10Sheet['!ref'] = `A1:${lastColLetter}${lastRow}`;

    // 7. Обновить выравнивание столбцов (добавить для новых ячеек)
    if (!top10Sheet['!cols']) {
        top10Sheet['!cols'] = [];
    }

    // Убедимся, что первые два столбца имеют достаточную ширину
    if (!top10Sheet['!cols'][0]) {
        top10Sheet['!cols'][0] = { wch: 10 };  // БС
    }
    if (!top10Sheet['!cols'][1]) {
        top10Sheet['!cols'][1] = { wch: 20 };  // Пострадавших сот
    }

    console.log('\n  Подсчёт пострадавших сот завершён');
    console.log(`  Добавлена мини-таблица: ${stats.length} записей`);
}

module.exports = {
    processBsCellsStats,
    extractCellPrefix,
    countCellsInTable1
};
