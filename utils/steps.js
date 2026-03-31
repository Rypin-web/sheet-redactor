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
const additionalColumnsProcessor = require('./additional-columns-processor');

/**
 * Шаг 0: Выбор сценария
 * @returns {Promise<'back'|{type: string, scenarioIndex: number, startStep: number}>}
 */
async function chooseScenario() {
    const stepNum = state.getStep();
    console.log(`\n=== ГЛАВНОЕ МЕНЮ ===`);
    
    console.log('\nПрошлые даты или последние сутки:');
    const choice = await prompts.displayMenu(state.SCENARIO_NAMES, 'Введите номер');
    
    // Проверяем на возврат
    if (choice === 'back') {
        console.log('\nВыход из программы...');
        process.exit(1);
    }
    
    // Записываем выбор
    state.updateState('scenario', choice);
    console.log(`→ ${state.SCENARIO_NAMES[choice - 1]}`);

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
    
    console.log(`\n${promptText}:`);
    const choice = await prompts.displayMenu(files, 'Введите номер');
    
    // Проверяем на возврат
    if (choice === 'back') {
        return 'back';
    }
    
    // Записываем в state
    const fileName = files[choice - 1];
    state.updateState(`${tableKey}.file`, fileName);
    console.log(`→ ${fileName}`);
    
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
    const cellsHeaders = fileData.headers.filter(v => v.toLowerCase().includes('cell'))

    console.log(`\nВ каком столбце имя СОТЫ?`);
    const choice = await prompts.displayMenu(cellsHeaders, 'Введите номер');
    
    // Проверяем на возврат
    if (choice === 'back') {
        return 'back';
    }
    
    // Записываем в state
    const titleName = cellsHeaders[choice - 1];
    state.updateState(`${tableKey}.title`, titleName);
    console.log(`→ ${titleName}`);

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
    
    console.log(`\nВыберите сравниваемый KPI":`);
    const choice = await prompts.displayMenu(headers, 'Введите номер');
    
    // Проверяем на возврат
    if (choice === 'back') {
        return 'back';
    }
    
    // Записываем в state
    const valueName = headers[choice - 1];
    state.updateState(`${tableKey}.value1`, valueName);
    console.log(`→ ${valueName}`);
    
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

    console.log(`\nВ каком столбце ВЕС соты?`);
    const rateHeaders = fileData.headers.filter(v => v.toLowerCase().includes('rate'))
    const choice = await prompts.displayMenu(rateHeaders, 'Введите номер');
    
    // Проверяем на возврат
    if (choice === 'back') {
        return 'back';
    }
    
    // Записываем в state
    const valueName = rateHeaders[choice - 1];
    state.updateState(`${tableKey}.value2`, valueName);
    console.log(`→ ${valueName}`);

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
    
    console.log(pointName === 'А'
      ? `\nКогда было ХОРОШО (точка А)?`
      : `\nКогда было ПЛОХО (точка Б)?`
    )
    const choice = await prompts.displayMenu(uniqueDates, 'Введите номер');
    
    // Проверяем на возврат
    if (choice === 'back') {
        return 'back';
    }
    
    // Записываем в state
    const pointDate = uniqueDates[choice - 1];
    state.updateState(pointName === 'А' ? 'pointA' : 'pointB', pointDate);
    console.log(`→ ${pointDate}`);
    
    return true;
}

/**
 * Шаг: Выбор alarm-table (только для сценариев 3 и 4)
 * @param {string} point - Точка ('A' или 'B' латиницей)
 * @returns {Promise<'back'|true>}
 */
async function promptAlarmTable(point) {
    const stepNum = state.getStep();
    const pointDate = state.getStateField(point === 'A' ? 'pointA' : 'pointB');
    const pointDisplay = point === 'A' ? 'А' : 'Б';  // Для отображения (кириллица)

    // Получаем список файлов
    const files = fs.listFiles();

    if (files.length === 0) {
        console.log('❌ В директории не найдено XLSX файлов');
        return true;
    }

    console.log(`\nВыберите alarm-table за точку ${pointDisplay} (${pointDate}) (или 0 для пропуска):`);

    // Добавляем опцию "0) Пропустить"
    const menuItems = ['Пропустить (без аварий)', ...files];
    const choice = await prompts.displayMenu(menuItems, 'Введите номер');

    // Проверяем на возврат
    if (choice === 'back') {
        return 'back';
    }

    // Записываем в state
    if (choice === 1) {
        // Выбрано "Пропустить"
        state.updateState(`alarmReport.point${point}`, '');
        console.log('→ Обработка аварий пропущена');
    } else {
        // Выбран файл
        const fileName = files[choice - 2];
        state.updateState(`alarmReport.point${point}`, fileName);
        console.log(`→ ${fileName}`);
    }

    return true;
}

/**
 * Шаг: Выбор дополнительных столбцов
 * Показывает общие заголовки из table1 и table2, исключая уже выбранные
 * @returns {Promise<'back'|true>}
 */
async function promptAdditionalColumns() {
    const stepNum = state.getStep();

    // Получаем имена файлов
    const file1 = state.getStateField('table1.file');
    const file2 = state.getStateField('table2.file');

    if (!file1 || !file2) {
        console.log('  Таблицы 1 или 2 не выбраны, пропускаем');
        return true;
    }

    // Читаем обе таблицы
    const fileData1 = fs.readXLSX(file1);
    const fileData2 = fs.readXLSX(file2);

    const headers1 = fileData1.headers;
    const headers2 = fileData2.headers;

    // Получаем уже выбранные заголовки
    const title1 = state.getStateField('table1.title');
    const value1_1 = state.getStateField('table1.value1');
    const value2_1 = state.getStateField('table1.value2');
    const title2 = state.getStateField('table2.title');
    const value1_2 = state.getStateField('table2.value1');
    const value2_2 = state.getStateField('table2.value2');

    // Получаем доступные заголовки для выбора
    const availableHeaders = additionalColumnsProcessor.getAvailableHeaders(
        headers1, headers2,
        title1, value1_1, value2_1,
        title2, value1_2, value2_2
    );

    if (availableHeaders.length === 0) {
        console.log('  Нет доступных заголовков для выбора, пропускаем');
        return true;
    }

    console.log(`\nВыберите дополнительные столбцы для добавления в результат:`);
    console.log('(введите номера через пробел, например: 2 3 5, или 0 для пропуска)');

    // Выводим меню
    console.log('');
    availableHeaders.forEach((item, index) => {
        console.log(`${index + 1}) ${item}`);
    });
    console.log('');

    // Получаем сырой ввод
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('Введите номера через пробел ', (answer) => {
            rl.close();

            // Проверяем на команду возврата
            if (prompts.isGoBack(answer)) {
                resolve('back');
                return;
            }

            // Парсим номера: разбиваем по пробелам, фильтруем пустые, конвертируем в числа
            const numbers = answer
                .trim()
                .split(/\s+/)
                .map(n => parseInt(n, 10))
                .filter(n => !isNaN(n) && n > 0);

            // Дедупликация и фильтрация валидных номеров
            const uniqueNumbers = [...new Set(numbers)]
                .filter(n => n >= 1 && n <= availableHeaders.length);

            if (uniqueNumbers.length === 0) {
                // Ничего не выбрано
                state.updateState('additionalColumns', []);
                console.log('→ Дополнительные столбцы не выбраны');
            } else {
                // Преобразуем номера в названия заголовков
                const selectedHeaders = uniqueNumbers.map(n => availableHeaders[n - 1]);
                state.updateState('additionalColumns', selectedHeaders);
                console.log(`→ Выбрано столбцов: ${selectedHeaders.length}`);
                selectedHeaders.forEach(h => console.log(`   - ${h}`));
            }

            resolve(true);
        });
    });
}

module.exports = {
    chooseScenario,
    promptTable,
    promptTitle,
    promptValue1,
    promptValue2,
    promptPoint,
    promptAlarmTable,
    promptAdditionalColumns
};
