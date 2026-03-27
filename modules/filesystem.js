/**
 * Модуль файловой системы
 * Отвечает за: определение пути запуска, чтение/запись файлов, навигацию
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

/**
 * Получить базовый путь (директория запуска)
 * При работе из EXE — папка с EXE
 * При разработке — директория, откуда запущен node
 */
function getBasePath() {
    if (process.pkg) {
        // Запуск из скомпилированного EXE
        return path.dirname(process.execPath);
    }
    // Запуск из исходников (node main.js) — возвращаем рабочую директорию процесса
    return process.cwd();
}

/**
 * Получить список XLSX файлов в директории запуска
 * Для EXE — ищем в папке с EXE
 * Для разработки — ищем в input/
 * @returns {string[]} Массив имён файлов
 */
function listFiles() {
    const basePath = getBasePath();
    // Для разработки используем input/, для EXE — корень папки
    const searchPath = process.pkg ? basePath : path.join(basePath, 'input');
    const files = fs.readdirSync(searchPath);

    // Фильтруем только .xlsx файлы (регистронезависимо)
    return files.filter(file =>
        file.toLowerCase().endsWith('.xlsx')
    );
}

/**
 * Прочитать XLSX файл
 * @param {string} filename - Имя файла (без пути)
 * @returns {object} Объект с данными: { headers: string[], rows: any[][] }
 */
function readXLSX(filename) {
    const basePath = getBasePath();
    // Для разработки используем input/, для EXE — корень папки
    const searchPath = process.pkg ? basePath : path.join(basePath, 'input');
    const filePath = path.join(searchPath, filename);

    // Проверка существования файла
    if (!fs.existsSync(filePath)) {
        throw new Error(`Файл не найден: ${filePath}`);
    }

    try {
        // Чтение XLSX через SheetJS
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0]; // Берём первый лист
        const worksheet = workbook.Sheets[sheetName];

        // Конвертация в массив массивов (header: 1 даёт сырые данные)
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (data.length === 0) {
            throw new Error('Файл пуст или не содержит данных');
        }

        // Первая строка — заголовки
        const headers = data[0].map(h => String(h).trim());
        // Остальные строки — данные
        const rows = data.slice(1);

        return { headers, rows };
    } catch (err) {
        throw new Error(`Ошибка чтения файла "${filename}": ${err.message}`);
    }
}

/**
 * Обеспечить существование директории output
 * Для EXE — возвращаем корень папки (сохраняем рядом с EXE)
 * Для разработки — создаём output/ в корне проекта
 * @returns {string} Путь к директории для сохранения
 */
function ensureOutputDir() {
    const basePath = getBasePath();
    // Для разработки используем output/ в корне, для EXE — корень папки
    const outputDir = process.pkg ? basePath : path.join(basePath, 'output');
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    return outputDir;
}

/**
 * Записать результат в XLSX файл (один лист)
 * @param {any[]} data - Массив объектов для записи
 * @param {string} sheetName - Название листа
 * @returns {string} Путь к сохранённому файлу
 */
function writeXLSXSingle(data, sheetName = 'Result') {
    const outputDir = ensureOutputDir();
    const timestamp = Date.now();
    const filename = `Result_${timestamp}.xlsx`;
    const filePath = path.join(outputDir, filename);
    
    try {
        // Создание workbook и worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(data);
        
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        XLSX.writeFile(workbook, filePath);
        
        return filePath;
    } catch (err) {
        throw new Error(`Ошибка записи файла: ${err.message}`);
    }
}

/**
 * Записать workbook с несколькими листами в XLSX файл
 * Автоматически выравнивает столбцы по ширине заголовков
 * @param {object} workbook - Workbook объект SheetJS
 * @returns {string} Путь к сохранённому файлу
 */
function writeXLSX(workbook) {
    const outputDir = ensureOutputDir();
    const timestamp = Date.now();
    const filename = `TOP_BAD_CELLS_${timestamp}.xlsx`;
    const filePath = path.join(outputDir, filename);

    try {
        // Выравниваем столбцы на каждом листе
        for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            
            // Получаем заголовки из первой строки
            const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
            const headers = [];
            
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddr = XLSX.utils.encode_cell({ r: 0, c: col });
                const cell = worksheet[cellAddr];
                headers.push(cell ? String(cell.v) : '');
            }
            
            // Вычисляем ширину столбцов по заголовкам
            // SheetJS использует единицы, которые немного шире символов
            // Поэтому используем коэффициент для компенсации
            const colWidths = headers.map(h => {
                const width = Math.max(h.length, 3);
                // Уменьшаем ширину на ~10% для точного соответствия
                return { wch: Math.ceil(width * 0.95) };
            });
            
            worksheet['!cols'] = colWidths;
        }

        XLSX.writeFile(workbook, filePath);
        
        // Возвращаем путь и имя файла
        return { filePath, filename };
    } catch (err) {
        throw new Error(`Ошибка записи файла: ${err.message}`);
    }
}

/**
 * Открыть файл в приложении по умолчанию
 * @param {string} filePath - Полный путь к файлу
 */
function openFile(filePath) {
    try {
        if (process.platform === 'win32') {
            // Windows
            require('child_process').exec(`start "" "${filePath}"`);
        } else if (process.platform === 'darwin') {
            // macOS
            require('child_process').exec(`open "${filePath}"`);
        } else {
            // Linux
            require('child_process').exec(`xdg-open "${filePath}"`);
        }
    } catch (err) {
        console.error(`Не удалось открыть файл: ${err.message}`);
    }
}

module.exports = {
    getBasePath,
    listFiles,
    readXLSX,
    ensureOutputDir,
    writeXLSXSingle,
    writeXLSX,
    openFile
};
