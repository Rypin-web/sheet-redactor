/**
 * Модуль обработки Alarm-отчёта
 * Добавляет столбцы "БС" и "Аварии" на лист "ТОП-10"
 */

const XLSX = require('xlsx');
const fs = require('../modules/filesystem');

/**
 * Извлечь БС из полного имени соты
 * @param {string} fullName - Полное имя соты (например, "MK4345_02")
 * @returns {string} БС (например, "MK1345" или "MK0132")
 */
function extractBsName(fullName) {
    // Берём часть до "_"
    const bsPart = fullName.split('_')[0];  // "MK4345" или "LR0132"
    
    // Извлекаем буквы (первые 2) и цифры (4 знака)
    const letters = bsPart.match(/[A-Z]{2}/i);
    const numbersMatch = bsPart.match(/\d{4}/);
    
    if (!letters || !numbersMatch) {
        return bsPart;  // Если не удалось распознать, возвращаем как есть
    }
    
    const letterPart = letters[0];
    const numberStr = numbersMatch[0];  // "4345" или "0132" (строка!)
    const numberPart = parseInt(numberStr);  // 4345 или 132 (число)
    
    // Если число >= 3000, вычитаем 3000
    const bsNumber = numberPart >= 3000 ? numberPart - 3000 : numberPart;
    
    // Форматируем обратно с ведущими нулями (4 знака)
    const bsNumberStr = String(bsNumber).padStart(4, '0');
    
    return letterPart + bsNumberStr;
}

/**
 * Найти индекс столбца по названию (с проверкой вариантов с пробелом и без)
 * @param {string[]} headers - Массив заголовков
 * @param {string} name1 - Первый вариант названия (без пробела)
 * @param {string} name2 - Второй вариант названия (с пробелом)
 * @returns {number} Индекс столбца или -1
 */
function findColumnIndex(headers, name1, name2) {
    let index = headers.findIndex(h => h === name1);
    if (index >= 0) return index;
    
    index = headers.findIndex(h => h === name2);
    if (index >= 0) return index;
    
    return -1;
}

/**
 * Обработать Alarm-отчёт и добавить данные на лист "ТОП-10"
 * @param {object} workbook - Workbook объект SheetJS (созданный, но не сохранённый)
 * @param {string} alarmFileName - Имя файла alarm-table
 */
function processAlarmReport(workbook, alarmFileName) {
    console.log('\n=== ОБРАБОТКА ALARM-ОТЧЁТА ===');
    
    // 1. Читаем alarm-table
    console.log('Чтение alarm-table...');
    const alarmData = fs.readXLSX(alarmFileName);
    const { headers: alarmHeaders, rows: alarmRows } = alarmData;
    
    // 2. Находим индексы нужных столбцов
    const alarmSourceIdx = findColumnIndex(alarmHeaders, 'AlarmSource', 'Alarm Source');
    const alarmNameIdx = findColumnIndex(alarmHeaders, 'AlarmName', 'Alarm Name');
    const locationInfoIdx = findColumnIndex(alarmHeaders, 'LocationInformation', 'Location Information');
    
    if (alarmSourceIdx === -1 || alarmNameIdx === -1 || locationInfoIdx === -1) {
        console.error('❌ Не найдены нужные столбцы в alarm-table');
        console.error(`  AlarmSource: ${alarmSourceIdx}, AlarmName: ${alarmNameIdx}, LocationInformation: ${locationInfoIdx}`);
        return;
    }
    
    console.log(`  Найдены столбцы: AlarmSource=${alarmSourceIdx}, AlarmName=${alarmNameIdx}, LocationInformation=${locationInfoIdx}`);
    
    // 3. Создаём копию alarm-данных для удаления (буфер)
    let alarmBuffer = alarmRows.map(row => ({...row}));
    
    // 4. Получаем лист "ТОП-10"
    const sheet = workbook.Sheets['ТОП-10'];
    if (!sheet) {
        console.error('❌ Лист "ТОП-10" не найден');
        return;
    }
    
    // 5. Преобразуем лист в массив объектов
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`\nОбработка ${data.length} записей на листе "ТОП-10"...`);
    
    // 6. Для каждой строки (соты) обрабатываем аварии
    for (const row of data) {
        const fullName = row['Название'];  // Полное имя соты, например "MK4345_02"
        if (!fullName) continue;
        
        // 6.1. Извлекаем БС
        const bsName = extractBsName(fullName);
        row['БС'] = bsName;
        
        // 6.2. Поиск аварий в AlarmSource (точное совпадение с БС)
        // Также проверяем LocationInformation на наличие любой записи Cell Name
        const alarms = [];

        for (let i = alarmBuffer.length - 1; i >= 0; i--) {
            const alarmSource = alarmBuffer[i][alarmSourceIdx];
            if (alarmSource === bsName) {
                // Точное совпадение БС
                const alarmName = alarmBuffer[i][alarmNameIdx];
                const location = alarmBuffer[i][locationInfoIdx];
                
                // Проверяем, есть ли в LocationInformation любая запись Cell Name
                // (не обязательно совпадающая с текущей сотой)
                const anyCellNameMatch = location && location.match(/Cell Name=([^,\s]+)/);
                
                if (anyCellNameMatch && anyCellNameMatch[1]) {
                    // Найдена конкретная сота на этой БС (любая)
                    const cellName = anyCellNameMatch[1];
                    alarms.push(`БС [${cellName}]: ${alarmName}`);
                } else {
                    // Авария всей БС (без привязки к соте)
                    alarms.push(`БС: ${alarmName}`);
                }
                
                // Удаляем из буфера (чтобы не найти повторно в LocationInformation)
                alarmBuffer.splice(i, 1);
            }
        }
        
        // 6.3. Поиск аварий в LocationInformation (по точному совпадению "Cell Name=[полное имя соты]")
        const cellSearchString = `Cell Name=${fullName}`;

        for (const alarmRow of alarmBuffer) {
            const location = alarmRow[locationInfoIdx];
            if (location && location.includes(cellSearchString)) {
                const alarmName = alarmRow[alarmNameIdx];
                alarms.push(`СОТА: ${alarmName}`);
            }
        }
        
        // 6.4. Записываем аварии (через \n = Alt+Enter в Excel)
        row['Аварии'] = alarms.join('\n');
    }
    
    // 7. Обновляем заголовки
    // Новый порядок: БС | Название | ... | Аварии
    // Берём оригинальные заголовки из данных (без БС и Аварии)
    const originalHeaders = Object.keys(data[0] || {}).filter(h => h !== 'БС' && h !== 'Аварии');
    const newHeaders = ['БС', ...originalHeaders, 'Аварии'];
    
    // 8. Пересоздаём лист с новыми данными
    const newSheet = XLSX.utils.json_to_sheet(data, { header: newHeaders });
    
    // 9. Выравниваем столбцы
    const colWidths = newHeaders.map(h => ({ wch: Math.max(h.length, 5) * 0.8 }));
    newSheet['!cols'] = colWidths;
    
    // 10. Заменяем лист в workbook
    workbook.Sheets['ТОП-10'] = newSheet;
    
    console.log('✅ Обработка alarm-отчёта завершена');
    console.log(`  Добавлены столбцы: БС, Аварии`);
}

module.exports = {
    processAlarmReport,
    extractBsName,
    findColumnIndex
};
