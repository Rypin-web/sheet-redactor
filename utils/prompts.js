/**
 * Модуль пользовательского ввода
 * Отвечает за: вывод меню, запрос чисел с валидацией, обработка возврата назад
 */

const readline = require('readline');

/**
 * Создать интерфейс для чтения из stdin
 */
function createInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

/**
 * Проверить, является ли ввод командой возврата назад
 * @param {string} input - Ввод пользователя
 * @returns {boolean} true если это команда возврата
 */
function isGoBack(input) {
    if (!input) return false;
    const trimmed = input.trim().toLowerCase();
    return trimmed === 'r' || trimmed === 'к';
}

/**
 * Вывести нумерованный список и получить выбор пользователя
 * @param {string[]} items - Массив элементов для вывода
 * @param {string} question - Текст вопроса
 * @returns {Promise<number|string>} Индекс выбранного элемента (1-based) или 'back' если пользователь ввёл r/к
 */
async function displayMenu(items, question) {
    const rl = createInterface();

    console.log('');
    items.forEach((item, index) => {
        console.log(`${index + 1}) ${item}`);
    });
    console.log('');

    return new Promise((resolve) => {
        rl.question(question + ' ', (answer) => {
            rl.close();
            
            // Проверяем на команду возврата
            if (isGoBack(answer)) {
                resolve('back');
                return;
            }
            
            const num = parseInt(answer, 10);
            resolve(num);
        });
    });
}

/**
 * Запросить нажатие Enter перед выходом
 */
function waitForEnter() {
    const rl = createInterface();
    
    return new Promise((resolve) => {
        rl.question('\nНажмите Enter для выхода...', () => {
            rl.close();
            resolve();
        });
    });
}

/**
 * Вывести сообщение об ошибке и ждать Enter
 * @param {string} message - Текст ошибки
 */
async function showErrorAndWait(message) {
    console.log('');
    console.log('ERROR: ' + message);
    console.log('');
    await waitForEnter();
}

module.exports = {
    displayMenu,
    isGoBack,
    waitForEnter,
    showErrorAndWait
};
