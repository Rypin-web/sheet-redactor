/**
 * Модуль пользовательского ввода
 * Отвечает за: вывод меню, запрос чисел с валидацией
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
 * Вывести нумерованный список и получить выбор пользователя
 * @param {string[]} items - Массив элементов для вывода
 * @param {string} question - Текст вопроса
 * @returns {Promise<number>} Индекс выбранного элемента (0-based)
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
            const num = parseInt(answer, 10);
            resolve(num);
        });
    });
}

/**
 * Запросить число с валидацией диапазона
 * Повторяет вопрос при неверном вводе
 * @param {number} max - Максимальное допустимое значение
 * @param {number} min - Минимальное допустимое значение (по умолчанию 1)
 * @param {string} question - Текст вопроса
 * @returns {Promise<number>} Валидное число
 */
async function askNumber(max, question, min = 1) {
    const rl = createInterface();
    
    return new Promise((resolve) => {
        const ask = () => {
            rl.question(`${question} (от ${min} до ${max}): `, (answer) => {
                const num = parseInt(answer, 10);
                
                if (isNaN(num) || num < min || num > max) {
                    console.log(`ERROR: Неверный ввод. Введите число от ${min} до ${max}`);
                    ask(); // Повторный запрос
                    return;
                }
                
                rl.close();
                resolve(num);
            });
        };
        
        ask();
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
    askNumber,
    waitForEnter,
    showErrorAndWait
};
