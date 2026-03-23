/**
 * Модуль управления состоянием (State Machine)
 * Хранит: названия таблиц, заголовки, даты точек
 * Не хранит: данные таблиц, заголовки файлов
 */

/**
 * Список сценариев для главного меню
 */
const SCENARIO_NAMES = [
    `Прошлые даты: Обе сравниваемые точки – в одной таблице`,
    'Прошлые даты: Сравниваемые точки – в разных таблицах \n',
    'Последние сутки: Обе сравниваемые точки – в одной таблице, Rate –  в отдельной',
    'Последние сутки: Сравниваемые точки — в двух разных таблицах, Rate —  в третьей'
];

/**
 * Начальное состояние
 */
const initialState = {
    scenario: null,       // Выбранный сценарий (номер)
    currentStep: 0,       // Текущий шаг в сценарии

    // Таблицы (количество зависит от сценария)
    table1: {
        file: '',         // Имя файла
        title: '',        // Заголовок НАЗВАНИЯ (СОТЫ)
        value1: '',       // Заголовок ПЕРВОГО ЗНАЧЕНИЯ (CCSR)
        value2: ''        // Заголовок ВТОРОГО ЗНАЧЕНИЯ (Rate)
    },
    table2: {
        file: '',
        title: '',
        value1: '',
        value2: ''
    },
    table3: {
        file: '',
        title: '',
        value1: '',
        value2: ''
    },

    // Alarm-table (только для сценариев 3 и 4)
    alarmTable: {
        file: ''        // Имя файла alarm-table (пустое = пропустить)
    },

    // Точки — просто даты, не привязаны к таблицам
    pointA: '',           // Дата точки А (DD.MM.YY HH:MM)
    pointB: ''            // Дата точки Б (DD.MM.YY HH:MM)
};

/**
 * Текущее состояние
 */
let state = null;

/**
 * Инициализировать состояние (вызвать при старте программы)
 */
function initState() {
    state = { ...initialState };
    // Глубокое копирование для вложенных объектов
    state.table1 = { ...initialState.table1 };
    state.table2 = { ...initialState.table2 };
    state.table3 = { ...initialState.table3 };
    state.alarmTable = { ...initialState.alarmTable };
    return state;
}

/**
 * Получить текущее состояние
 * @returns {object} Копия текущего state
 */
function getState() {
    return state ? { ...state } : null;
}

/**
 * Получить поле из state по пути
 * @param {string} path - Путь к полю (напр. 'table1.file', 'pointA')
 * @returns {any} Значение поля или null
 */
function getStateField(path) {
    if (!state) return null;
    
    const parts = path.split('.');
    let current = state;
    
    for (const part of parts) {
        if (current[part] === undefined) {
            return null;
        }
        current = current[part];
    }
    
    return current;
}

/**
 * Обновить поле в state по пути
 * @param {string} path - Путь к полю (напр. 'table1.file', 'pointA')
 * @param {any} value - Новое значение
 */
function updateState(path, value) {
    if (!state) {
        initState();
    }
    
    const parts = path.split('.');
    let current = state;
    
    // Проходим по всем частям пути, кроме последней
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current[part] === undefined) {
            current[part] = {};
        }
        current = current[part];
    }
    
    // Устанавливаем значение последнего поля
    const lastPart = parts[parts.length - 1];
    current[lastPart] = value;
}

/**
 * Установить текущий шаг в сценарии
 * @param {number} step - Индекс шага
 */
function setStep(step) {
    if (state) {
        state.currentStep = step;
    }
}

/**
 * Получить текущий шаг
 * @returns {number} Индекс текущего шага
 */
function getStep() {
    return state ? state.currentStep : 0;
}

/**
 * Сбросить состояние к начальному
 */
function reset() {
    state = null;
    initState();
}

module.exports = {
    initState,
    getState,
    getStateField,
    updateState,
    setStep,
    getStep,
    reset,
    SCENARIO_NAMES
};
