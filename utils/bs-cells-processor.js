/**
 * Модуль подсчёта пострадавших сот на БС
 * Добавляет мини-таблицу на лист "ТОП-10" (начиная со строки 13)
 */

const XLSX = require('xlsx');

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
 * Считать количество сот с данным префиксом в Таблице 1
 * @param {Array<{date: string, title: string, value: any}>} table1Data - Данные Таблицы 1
 * @param {string} cellPrefix - Префикс соты (например, "MK4123")
 * @returns {number} Количество совпадений
 */
function countCellsInTable1(table1Data, cellPrefix) {
    if (!table1Data || !cellPrefix) return 0;
    
    // Нестрогое совпадение: title.includes(cellPrefix)
    const count = table1Data.filter(item => 
        item.title && item.title.includes(cellPrefix)
    ).length;
    
    return count;
}

/**
 * Обработать статистику по БС и добавить мини-таблицу на лист "ТОП-10"
 * @param {object} workbook - Workbook объект SheetJS (созданный, но не сохранённый)
 * @param {Array<{date: string, title: string, value: any}>} table1Data - Данные Таблицы 1
 */
function processBsCellsStats(workbook, table1Data) {
    console.log('\n=== ПОДСЧЁТ ПОСТРАДАВШИХ СОТ НА БС ===');
    
    // 1. Получить лист "ТОП-10"
    const sheet = workbook.Sheets['ТОП-10'];
    if (!sheet) {
        console.error('❌ Лист "ТОП-10" не найден');
        return;
    }
    
    // 2. Преобразуем лист в массив объектов
    const data = XLSX.utils.sheet_to_json(sheet);
    
    if (data.length === 0) {
        console.log('  Лист "ТОП-10" пуст, пропускаем обработку');
        return;
    }
    
    console.log(`  Обработка ${data.length} записей на листе "ТОП-10"...`);
    
    // 3. Извлечь уникальные БС из столбца "БС"
    const uniqueBsSet = new Set();
    for (const row of data) {
        if (row['БС']) {
            uniqueBsSet.add(row['БС']);
        }
    }
    const uniqueBsList = Array.from(uniqueBsSet).sort();
    
    console.log(`  Найдено уникальных БС: ${uniqueBsList.length}`);
    
    // 4. Для каждой БС найти соответствующие соты в ТОП-10
    const bsToCellsMap = new Map();  // БС → Set<полные имена сот>
    
    for (const row of data) {
        const bsName = row['БС'];
        const fullName = row['Название'];  // "MK4123_02"
        
        if (!bsName || !fullName) continue;
        
        if (!bsToCellsMap.has(bsName)) {
            bsToCellsMap.set(bsName, new Set());
        }
        bsToCellsMap.get(bsName).add(fullName);
    }
    
    // 5. Для каждой БС посчитать статистику
    let stats = [];

    for (const bsName of uniqueBsList) {
        const cellsInTop10 = bsToCellsMap.get(bsName);
        const top10Count = cellsInTop10.size;

        // Берём любую соту из ТОП-10 для этой БС
        const anyCell = Array.from(cellsInTop10)[0];  // "MK4123_02"

        // Извлекаем префикс соты (для поиска в Таблице 1)
        const cellPrefix = extractCellPrefix(anyCell);  // "MK4123"

        // Считаем количество сот с этим префиксом в Таблице 1
        const totalInTable1 = countCellsInTable1(table1Data, cellPrefix);

        // Сравниваем: если все соты из Таблицы 1 попали в ТОП-10
        const result = (totalInTable1 === top10Count) ? 'ВСЕ' : top10Count;

        stats.push({
            'БС': bsName,
            'Пострадавших сот': result,
            '_sortValue': result === 'ВСЕ' ? Infinity : top10Count  // Для сортировки
        });

        console.log(`  БС ${bsName}: ${top10Count} из ${totalInTable1} → ${result}`);
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
    console.log('  Запись мини-таблицы на лист...');
    
    // Строка 13: заголовки
    sheet['A13'] = { v: 'БС', t: 's' };
    sheet['B13'] = { v: 'Пострадавших сот', t: 's' };
    
    // Строки 14+: данные
    for (let i = 0; i < stats.length; i++) {
        const row = 14 + i;
        sheet[`A${row}`] = { v: stats[i]['БС'], t: 's' };
        sheet[`B${row}`] = { v: stats[i]['Пострадавших сот'], t: typeof stats[i]['Пострадавших сот'] === 'string' ? 's' : 'n' };
    }
    
    // Обновить диапазон листа
    const lastRow = 13 + stats.length;
    sheet['!ref'] = `A1:G${lastRow}`;
    
    // 7. Обновить выравнивание столбцов (добавить для новых ячеек)
    if (!sheet['!cols']) {
        sheet['!cols'] = [];
    }
    
    // Убедимся, что первые два столбца имеют достаточную ширину
    if (!sheet['!cols'][0]) {
        sheet['!cols'][0] = { wch: 10 };  // БС
    }
    if (!sheet['!cols'][1]) {
        sheet['!cols'][1] = { wch: 20 };  // Пострадавших сот
    }
    
    console.log('✅ Подсчёт пострадавших сот завершён');
    console.log(`  Добавлена мини-таблица: ${stats.length} записей`);
}

module.exports = {
    processBsCellsStats,
    extractCellPrefix,
    countCellsInTable1
};
