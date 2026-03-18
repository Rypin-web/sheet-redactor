/**
 * Модуль парсинга данных
 * Отвечает за: поиск столбцов, извлечение и нормализацию данных
 */

/**
 * Найти индекс столбца RECDATE (case-insensitive)
 * @param {string[]} headers - Массив заголовков
 * @returns {number|null} Индекс столбца или null если не найден
 */
function findDateColumnIndex(headers) {
    const index = headers.findIndex(
        h => h.toLowerCase().trim() === 'recdate'
    );
    return index >= 0 ? index : null;
}

/**
 * Конвертировать число Excel в дату DD.MM.YY HH:MM
 * Excel хранит даты как количество дней с 30.12.1899
 * Целая часть = дни, дробная часть = время
 * Округляет до ближайшей минуты для устранения погрешностей
 * @param {number} excelDate - Число Excel
 * @returns {string} Дата в формате DD.MM.YY HH:MM
 */
function excelDateToString(excelDate) {
    // Excel epoch: 30 декабря 1899
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));

    // Конвертируем число в дату (умножаем на количество миллисекунд в дне)
    // Используем UTC чтобы избежать проблем с часовым поясом
    const totalMilliseconds = excelDate * 24 * 60 * 60 * 1000;
    const date = new Date(excelEpoch.getTime() + totalMilliseconds);

    // Получаем компоненты времени
    let seconds = date.getUTCSeconds();
    let minutes = date.getUTCMinutes();
    let hours = date.getUTCHours();
    let day = date.getUTCDate();
    let month = date.getUTCMonth() + 1;
    let year = date.getUTCFullYear();

    // Округляем минуты: если секунды >= 30, добавляем минуту
    if (seconds >= 30) {
        minutes++;
        if (minutes >= 60) {
            minutes = 0;
            hours++;
            if (hours >= 24) {
                hours = 0;
                day++;
                // Упрощённая обработка перехода месяца (для большинства случаев достаточно)
                const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
                if (day > daysInMonth) {
                    day = 1;
                    month++;
                    if (month > 12) {
                        month = 1;
                        year++;
                    }
                }
            }
        }
    }

    // Форматируем как DD.MM.YY HH:MM
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');
    const yearStr = String(year).slice(-2);
    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');

    return `${dayStr}.${monthStr}.${yearStr} ${hoursStr}:${minutesStr}`;
}

/**
 * Нормализовать дату из формата Excel (число или строка)
 * Возвращает дату в формате DD.MM.YY HH:MM для группировки
 * @param {string|number} dateValue - Значение даты (число Excel или строка)
 * @returns {string|null} Нормализованная дата или null если некорректно
 */
function parseDate(dateValue) {
    if (dateValue === null || dateValue === undefined) {
        return null;
    }

    // Если число — это дата Excel
    if (typeof dateValue === 'number') {
        try {
            return excelDateToString(dateValue);
        } catch (e) {
            return null;
        }
    }

    if (typeof dateValue !== 'string') {
        return null;
    }

    const trimmed = dateValue.trim();

    if (!trimmed) {
        return null;
    }

    // Ожидаем формат: DD.MM.YY HH:MM или DD.MM.YYYY HH:MM или DD.MM.YY или DD.MM.YYYY
    // С временем
    const matchWithTime = trimmed.match(/^(\d{2}\.\d{2}\.\d{2,4})\s+(\d{1,2}):(\d{2})/);
    if (matchWithTime) {
        const [, datePart, hours, minutes] = matchWithTime;
        const h = String(parseInt(hours)).padStart(2, '0');
        const m = String(parseInt(minutes)).padStart(2, '0');
        return `${datePart} ${h}:${m}`;
    }

    // Без времени
    const matchDate = trimmed.match(/^(\d{2}\.\d{2}\.\d{2,4})/);
    if (matchDate) {
        return `${matchDate[1]} 00:00`;
    }

    return null;
}

/**
 * Извлечь данные из таблицы по указанным индексам столбцов
 * Пропускает строки где RECDATE, title или value пустые
 * @param {any[][]} rows - Массив строк данных
 * @param {number} dateIndex - Индекс столбца даты
 * @param {number} titleIndex - Индекс столбца названия
 * @param {number} valueIndex - Индекс столбца значения
 * @returns {Array<{date: string, title: string, value: any}>}
 */
function extractData(rows, dateIndex, titleIndex, valueIndex) {
    const result = [];
    
    for (const row of rows) {
        // Получаем значения из строки
        const dateRaw = row[dateIndex];
        const title = row[titleIndex];
        const value = row[valueIndex];
        
        // Пропускаем строки с пустыми обязательными полями
        if (!dateRaw || !title) {
            continue;
        }

        // Нормализуем дату
        const date = parseDate(dateRaw);
        
        if (!date) {
            continue; // Пропускаем строки с некорректной датой
        }
        
        // Добавляем запись
        result.push({
            date,
            title: String(title).trim(),
            value: value !== undefined && value !== null ? value : ''
        });
    }

    return result;
}
/**
 * Получить все уникальные даты из данных
 * @param {Array<{date: string, title: string, value: any}>} data - Массив записей
 * @returns {string[]} Уникальные даты в формате DD.MM.YY HH:MM, отсортированные
 */
function getUniqueDates(data) {
    const unique = new Set(data.map(item => item.date));
    return Array.from(unique).sort((a, b) => {
        // Сортировка по дате и времени
        const [d1, m1, y1, h1, min1] = a.split(/[\.: ]/).map(Number);
        const [d2, m2, y2, h2, min2] = b.split(/[\.: ]/).map(Number);
        const date1 = new Date(y1 < 100 ? 2000 + y1 : y1, m1 - 1, d1, h1, min1);
        const date2 = new Date(y2 < 100 ? 2000 + y2 : y2, m2 - 1, d2, h2, min2);
        return date1 - date2;
    });
}

module.exports = {
    findDateColumnIndex,
    parseDate,
    extractData,
    getUniqueDates
};
