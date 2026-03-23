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
    // Запускаем поток выполнения
    await flow.runScenario(scenario1, allScenarios);
}

main();
