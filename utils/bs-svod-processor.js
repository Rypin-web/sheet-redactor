/**
 * Модуль создания сводной таблицы по БС
 * Создаёт лист "Свод по БС" при наличии двух alarm-отчётов
 */

const XLSX = require('xlsx');

/**
 * Создать сводную таблицу по БС
 * @param {object} workbook - Workbook объект SheetJS
 */
function createBsSvodSheet(workbook) {

    // 1. Получить лист "Ухудшились"
    const sourceSheet = workbook.Sheets['Ухудшились'];
    if (!sourceSheet) {
        console.error('  ❌ Лист "Ухудшились" не найден');
        return;
    }

    // 2. Преобразуем лист в массив объектов
    const data = XLSX.utils.sheet_to_json(sourceSheet);

    if (data.length === 0) {
        console.log('  Лист "Ухудшились" пуст, пропускаем');
        return;
    }

    // 3. Проверяем, что есть столбцы с авариями
    const hasAllAlarms = data[0]['Все текущие аварии'] !== undefined;
    const hasNewAlarms = data[0]['Новые аварии'] !== undefined;

    if (!hasAllAlarms || !hasNewAlarms) {
        console.log('  Нет столбцов с авариями, пропускаем');
        return;
    }

    console.log(`  Обработка ${data.length} записей...`);

    // 4. Извлечь уникальные БС
    const uniqueBsSet = new Set();
    for (const row of data) {
        if (row['БС']) {
            uniqueBsSet.add(row['БС']);
        }
    }
    const uniqueBsList = Array.from(uniqueBsSet).sort();

    console.log(`  Найдено уникальных БС: ${uniqueBsList.length}`);

    // 5. Для каждой БС собрать информацию
    const bsStats = [];

    for (const bsName of uniqueBsList) {

        // Найти все записи для этой БС
        const rowsForBs = data.filter(row => row['БС'] === bsName);

        // Собрать все уникальные названия сот
        const cellsSet = new Set();
        for (const row of rowsForBs) {
            if (row['Название']) {
                cellsSet.add(row['Название']);
            }
        }
        const cellsList = Array.from(cellsSet).sort();
        const cellsString = cellsList.join('\n');

        // Собрать все уникальные аварии (Все текущие)
        const allAlarmsSet = new Set();
        for (const row of rowsForBs) {
            const alarms = row['Все текущие аварии'];
            if (alarms) {
                const alarmList = alarms.split('\n');
                for (const alarm of alarmList) {
                    if (alarm.trim()) {
                        allAlarmsSet.add(alarm.trim());
                    }
                }
            }
        }
        const allAlarmsString = Array.from(allAlarmsSet).join('\n');
        const allAlarmsCount = allAlarmsSet.size;

        // Собрать все уникальные Новые аварии
        const newAlarmsSet = new Set();
        for (const row of rowsForBs) {
            const alarms = row['Новые аварии'];
            if (alarms) {
                const alarmList = alarms.split('\n');
                for (const alarm of alarmList) {
                    if (alarm.trim()) {
                        newAlarmsSet.add(alarm.trim());
                    }
                }
            }
        }
        const newAlarmsString = Array.from(newAlarmsSet).join('\n');
        const newAlarmsCount = newAlarmsSet.size;

        // Вычислить Разницу и Процент
        const raznica = allAlarmsCount - newAlarmsCount;
        const percent = allAlarmsCount > 0 ? (1 - (newAlarmsCount / allAlarmsCount)) : 0;

        bsStats.push({
            'БС': bsName,
            'Названия': cellsString,
            'Все аварии': allAlarmsString,
            'Количество (Все)': allAlarmsCount,
            'Новые аварии': newAlarmsString,
            'Количество (Новые)': newAlarmsCount,
            'Разница': raznica,
            'Процент': percent
        });

    }

    // 6. Сортировка по убыванию "Процент"
    bsStats.sort((a, b) => b['Процент'] - a['Процент']);

    // 7. Создать лист "Свод по БС"
    const svodSheet = XLSX.utils.json_to_sheet(bsStats);

    // 8. Выравнивание столбцов
    const headers = [
        'БС',
        'Названия',
        'Все аварии',
        'Количество (Все)',
        'Новые аварии',
        'Количество (Новые)',
        'Разница',
        'Процент'
    ];
    const colWidths = headers.map(h => ({ wch: Math.max(h.length, 15) * 0.8 }));
    svodSheet['!cols'] = colWidths;

    // 9. Добавить лист в workbook
    XLSX.utils.book_append_sheet(workbook, svodSheet, 'Свод по БС');

    console.log('✅ Лист "Свод по БС" создан');
    console.log(`  Записей: ${bsStats.length}`);
}

module.exports = {
    createBsSvodSheet
};
