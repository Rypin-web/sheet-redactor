/**
 * Sheet Redactor - Утилита для объединения CSV таблиц
 * Точка входа приложения
 */

const XLSX = require('xlsx');
const fs = require('./modules/filesystem');
const parser = require('./modules/parser');
const merger = require('./modules/merger');
const calculator = require('./modules/calculator');
const prompts = require('./utils/prompts');
const oldDataScenario = require('./scenarios/old-data');
const newDataScenario = require('./scenarios/new-data');

async function main() {
    console.log('=== Sheet Redactor ===\n');
    
    // Выбор сценария работы
    console.log('Выберите сценарий работы:');
    console.log('1) Старые данные (value2 есть в Таблице 2)');
    console.log('2) Новые данные (value2 искать в прошлой таблице)');
    console.log('');
    
    const scenarioType = await prompts.askNumber(2, 'Выберите вариант');
    const useNewDataScenario = scenarioType === 2;
    
    console.log(`✅ Выбрано: ${useNewDataScenario ? 'Новые данные' : 'Старые данные'}`);
    console.log('');

    // 1. Получаем список XLSX файлов
    const files = fs.listFiles();
    
    if (files.length === 0) {
        console.log('❌ В директории не найдено XLSX файлов');
        console.log('Положите .xlsx файлы в папку с программой и запустите снова');
        await prompts.waitForEnter();
        process.exit(1);
    }

    // 2. Вызываем нужный сценарий
    if (useNewDataScenario) {
        await newDataScenario.run(files);
    } else {
        await oldDataScenario.run(files);
    }
}

main();
