/**
 * Sheet Redactor - Утилита для объединения XLSX таблиц
 * Точка входа приложения
 */

const state = require('./utils/state');
const flow = require('./utils/flow');
const { scenario1 } = require('./scenarios/execute-scenario1');
const { scenario2 } = require('./scenarios/execute-scenario2');
const { scenario3 } = require('./scenarios/execute-scenario3');
const { scenario4 } = require('./scenarios/execute-scenario4');

// Инициализируем state
state.initState();
// Массив всех сценариев
const allScenarios = [
    scenario1,  // Индекс 0: Сценарий 1 (Старые данные, точки в одной таблице)
    scenario2,  // Индекс 1: Сценарий 2 (Старые данные, точки в разных таблицах)
    scenario3,  // Индекс 2: Сценарий 3 (Новые данные, точки в одной таблице)
    scenario4   // Индекс 3: Сценарий 4 (Новые данные, точки в разных таблицах)
];

// Главная функция
async function main() {
    console.log('=== Sheet Redactor ===\n');

    console.log('Как работать:');
    console.log('1. Положите файлы .xlsx в папку с программой');
    console.log('2. Следуйте инструкциям программы');
    console.log('3. Результат откроется автоматически в Excel\n');

    console.log('Навигация:');
    console.log('  - "r" — вернуться на один вопрос назад');
    console.log('  - "0" — пропустить выбор (alarm-table, доп. столбцы)');

    console.log('\n!!! ВНИМАНИЕ !!!')
    console.log('\nПеред работой:')
    console.log(' 1. Убедитесь, что таблицы содержат нужные столбцы и они заполнены данными')
    console.log(' 2. Проверьте, чтобы файлы были сохранены в формате .xlsx')
    console.log(' 3. Если в результате таблица пустая или неверные результаты, проверьте указанные вами данные в' +
      ' программе')
    console.log('    Возможен вариант, что вы по случайности дважды указали ту же таблицу или точку')

    // Запускаем поток выполнения
    await flow.runScenario(scenario1, allScenarios);
}

main();
