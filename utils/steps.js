/**
 * Базовые функции-шаги для сценариев
 * Каждая функция:
 * - Самостоятельная (читает state, файлы по мере необходимости)
 * - Возвращает 'back' при вводе "r"/"к", true при успехе
 */

const state = require('./state');
const fs = require('../modules/filesystem');
const parser = require('../modules/parser');
const prompts = require('./prompts');

/**
 * Шаг 0: Выбор сценария
 * @returns {Promise<'back'|{type: string, scenarioIndex: number, startStep: number}>}
 */
async function chooseScenario() {
    const stepNum = state.getStep();
    console.log(`\n[ШАГ ${stepNum}] === ГЛАВНОЕ МЕНЮ ===`);
    
    console.log('\nВыберите сценарий:');
    const choice = await prompts.displayMenu(state.SCENARIO_NAMES, 'Введите номер');
    
    // Проверяем на возврат
    if (choice === 'back') {
        console.log('\nВыход из программы...');
        process.exit(1);
    }
    
    // Записываем выбор
    state.updateState('scenario', choice);
    console.log(`→ Выбран сценарий №${choice}`);
    
    // Возвращаем информацию для переключения сценария
    return {
        type: 'scenario_switch',
        scenarioIndex: choice - 1,  // 0-based индекс
        startStep: 1  // Начинаем с шага 1 (шаг 0 — это выбор сценария)
    };
}

/**
 * Шаг: Выбор файла таблицы
 * @param {string} tableKey - Ключ таблицы в state ('table1', 'table2', 'table3')
 * @param {string} promptText - Текст вопроса
 * @returns {Promise<'back'|true>}
 */
async function promptTable(tableKey, promptText = 'Выберите таблицу') {
    const stepNum = state.getStep();
    
    // Получаем список файлов
    const files = fs.listFiles();
    
    if (files.length === 0) {
        console.log('❌ В директории не найдено XLSX файлов');
        return true; // Пропускаем шаг (ошибка)
    }
    
    console.log(`\n[ШАГ ${stepNum}] ${promptText}:`);
    const choice = await prompts.displayMenu(files, 'Введите номер');
    
    // Проверяем на возврат
    if (choice === 'back') {
        return 'back';
    }
    
    // Записываем в state
    const fileName = files[choice - 1];
    state.updateState(`${tableKey}.file`, fileName);
    console.log(`→ Выбран файл: ${fileName}`);
    
    return true;
}

/**
 * Шаг: Выбор заголовка НАЗВАНИЯ (СОТЫ)
 * @param {string} tableKey - Ключ таблицы в state
 * @returns {Promise<'back'|true>}
 */
async function promptTitle(tableKey) {
    const stepNum = state.getStep();
    const fileName = state.getStateField(`${tableKey}.file`);
    
    if (!fileName) {
        console.error(`Ошибка: файл для ${tableKey} не выбран`);
        return true;
    }
    
    // Читаем файл
    const fileData = fs.readXLSX(fileName);
    const headers = fileData.headers;
    
    console.log(`\n[ШАГ ${stepNum}] Выберите заголовок НАЗВАНИЯ (СОТЫ) из "${fileName}":`);
    const choice = await prompts.displayMenu(headers, 'Введите номер');
    
    // Проверяем на возврат
    if (choice === 'back') {
        return 'back';
    }
    
    // Записываем в state
    const titleName = headers[choice - 1];
    state.updateState(`${tableKey}.title`, titleName);
    console.log(`→ Выбран заголовок: ${titleName}`);
    
    return true;
}

/**
 * Шаг: Выбор заголовка ПЕРВОГО ЗНАЧЕНИЯ (CCSR)
 * @param {string} tableKey - Ключ таблицы в state
 * @returns {Promise<'back'|true>}
 */
async function promptValue1(tableKey) {
    const stepNum = state.getStep();
    const fileName = state.getStateField(`${tableKey}.file`);
    
    if (!fileName) {
        console.error(`Ошибка: файл для ${tableKey} не выбран`);
        return true;
    }
    
    // Читаем файл
    const fileData = fs.readXLSX(fileName);
    const headers = fileData.headers;
    
    console.log(`\n[ШАГ ${stepNum}] Выберите заголовок ПЕРВОГО ЗНАЧЕНИЯ (CCSR) из "${fileName}":`);
    const choice = await prompts.displayMenu(headers, 'Введите номер');
    
    // Проверяем на возврат
    if (choice === 'back') {
        return 'back';
    }
    
    // Записываем в state
    const valueName = headers[choice - 1];
    state.updateState(`${tableKey}.value1`, valueName);
    console.log(`→ Выбран заголовок: ${valueName}`);
    
    return true;
}

/**
 * Шаг: Выбор заголовка ВТОРОГО ЗНАЧЕНИЯ (Rate)
 * @param {string} tableKey - Ключ таблицы в state
 * @returns {Promise<'back'|true>}
 */
async function promptValue2(tableKey) {
    const stepNum = state.getStep();
    const fileName = state.getStateField(`${tableKey}.file`);
    
    if (!fileName) {
        console.error(`Ошибка: файл для ${tableKey} не выбран`);
        return true;
    }
    
    // Читаем файл
    const fileData = fs.readXLSX(fileName);
    const headers = fileData.headers;
    
    console.log(`\n[ШАГ ${stepNum}] Выберите заголовок ВТОРОГО ЗНАЧЕНИЯ (Rate) из "${fileName}":`);
    const choice = await prompts.displayMenu(headers, 'Введите номер');
    
    // Проверяем на возврат
    if (choice === 'back') {
        return 'back';
    }
    
    // Записываем в state
    const valueName = headers[choice - 1];
    state.updateState(`${tableKey}.value2`, valueName);
    console.log(`→ Выбран заголовок: ${valueName}`);
    
    return true;
}

/**
 * Шаг: Выбор даты точки (А или Б)
 * @param {string} pointName - Название точки ('А' или 'Б')
 * @param {string} tableKey - Ключ таблицы в state (откуда брать даты)
 * @returns {Promise<'back'|true>}
 */
async function promptPoint(pointName, tableKey) {
    const stepNum = state.getStep();
    const fileName = state.getStateField(`${tableKey}.file`);
    
    if (!fileName) {
        console.error(`Ошибка: файл для ${tableKey} не выбран`);
        return true;
    }
    
    // Читаем файл и извлекаем данные
    const fileData = fs.readXLSX(fileName);
    const { headers, rows } = fileData;
    
    // Находим индекс RECDATE
    const dateIndex = parser.findDateColumnIndex(headers);
    if (dateIndex === null) {
        console.error('Ошибка: в файле не найден столбец RECDATE');
        return true;
    }
    
    // Извлекаем данные для получения уникальных дат
    const titleKey = state.getStateField(`${tableKey}.title`);
    const value1Key = state.getStateField(`${tableKey}.value1`);
    
    // Если заголовки ещё не выбраны, используем первый попавшийся
    const titleIndex = titleKey ? headers.indexOf(titleKey) : 1;
    const valueIndex = value1Key ? headers.indexOf(value1Key) : 2;
    
    const data = parser.extractData(rows, dateIndex, titleIndex >= 0 ? titleIndex : 1, valueIndex >= 0 ? valueIndex : 2);
    const uniqueDates = parser.getUniqueDates(data);
    
    if (uniqueDates.length === 0) {
        console.error('Ошибка: не найдено дат в файле');
        return true;
    }
    
    console.log(`\n[ШАГ ${stepNum}] Выберите дату для точки ${pointName}:`);
    const choice = await prompts.displayMenu(uniqueDates, 'Введите номер');
    
    // Проверяем на возврат
    if (choice === 'back') {
        return 'back';
    }
    
    // Записываем в state
    const pointDate = uniqueDates[choice - 1];
    state.updateState(pointName === 'А' ? 'pointA' : 'pointB', pointDate);
    console.log(`→ Выбрана дата: ${pointDate}`);
    
    return true;
}

module.exports = {
    chooseScenario,
    promptTable,
    promptTitle,
    promptValue1,
    promptValue2,
    promptPoint
};
