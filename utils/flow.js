/**
 * Модуль управления потоком выполнения сценариев
 * Последовательно вызывает шаги сценария, обрабатывает возврат назад
 */

const state = require('./state');

/**
 * Запустить выполнение сценария
 * @param {Array<Function>} scenarioSteps - Массив функций-шагов сценария
 * @param {Array<Array<Function>>} allScenarios - Все сценарии (для переключения)
 * @returns {Promise<void>}
 */
async function runScenario(scenarioSteps, allScenarios = null) {
    let currentStep = state.getStep();
    let currentScenario = scenarioSteps;
    
    while (currentStep < currentScenario.length) {
        const stepFunction = currentScenario[currentStep];
        
        if (typeof stepFunction !== 'function') {
            console.error(`Ошибка: шаг ${currentStep} не является функцией`);
            currentStep++;
            continue;
        }
        
        try {
            // Вызываем функцию шага
            const result = await stepFunction();
            
            // Обрабатываем результат
            if (result === 'back') {
                // Пользователь ввёл "r" или "к" — возвращаемся назад
                currentStep--;
                
                // Если вернулись на шаг 0 (выбор сценария) — выходим
                if (currentStep < 0) {
                    console.log('\nВыход из программы...');
                    process.exit(1);
                }
            } else if (result && typeof result === 'object' && result.type === 'scenario_switch') {
                // Переключение на другой сценарий
                const scenarioIndex = result.scenarioIndex;
                const startStep = result.startStep || 1;
                
                if (allScenarios && allScenarios[scenarioIndex]) {
                    currentScenario = allScenarios[scenarioIndex];
                    currentStep = startStep;
                } else {
                    console.error(`Ошибка: сценарий с индексом ${scenarioIndex} не найден`);
                    currentStep++;
                }
            } else if (result === true || result === undefined) {
                // Успешное выполнение шага — идём вперёд
                currentStep++;
            } else if (result === false) {
                // Альтернативный сигнал возврата
                currentStep--;
                
                if (currentStep < 0) {
                    console.log('\nВыход из программы...');
                    process.exit(1);
                }
            }
            // Если результат другой — просто идём дальше (для execute-функций)
            
        } catch (error) {
            console.error(`\nОшибка на шаге ${currentStep}: ${error.message}`);
            console.error(error.stack);
            
            // Спрашиваем, что делать дальше
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            await new Promise((resolve) => {
                rl.question('\nНажмите Enter для продолжения...', () => {
                    rl.close();
                    resolve();
                });
            });
            
            currentStep++;
        }
        
        // Обновляем текущий шаг в state
        state.setStep(currentStep);
    }
    
    // Сценарий завершён
    console.log('\n✅ Сценарий выполнен успешно!');
}

/**
 * Запустить выполнение сценария с указанного шага
 * @param {Array<Function>} scenarioSteps - Массив функций-шагов сценария
 * @param {number} startStep - Начальный шаг (по умолчанию 0)
 * @param {Array<Array<Function>>} allScenarios - Все сценарии (для переключения)
 * @returns {Promise<void>}
 */
async function runScenarioFrom(scenarioSteps, startStep = 0, allScenarios = null) {
    state.setStep(startStep);
    return runScenario(scenarioSteps, allScenarios);
}

module.exports = {
    runScenario,
    runScenarioFrom
};
