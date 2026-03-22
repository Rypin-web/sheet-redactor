/**
 * Модуль вычислений
 * Отвечает за: расчёт разницы, фильтрацию, сортировку
 */

/**
 * Добавить столбцы разницы к данным
 * Вычисляет значения в JavaScript (не формулы!)
 * Формула: ранняя дата - поздняя дата (А - Б)
 *
 * @param {any[]} rows - Массив строк данных
 * @param {string[]} headers - Массив заголовков
 * @param {string} valueName1 - Название столбца значений из таблицы 1
 * @param {string} valueName2 - Название столбца значений из таблицы 2
 * @param {string} pointLater - Более поздняя дата в формате DD.MM.YY HH:MM
 * @param {string} pointEarlier - Более ранняя дата в формате DD.MM.YY HH:MM
 * @returns {any[]} Данные с добавленными столбцами разницы
 */
function addDifferenceColumns(rows, headers, valueName1, valueName2, pointLater, pointEarlier) {
  // Названия столбцов по выбранным точкам
  const colLater1 = `${pointLater} (${valueName1})`
  const colEarlier1 = `${pointEarlier} (${valueName1})`
  const colLater2 = `${pointLater} (${valueName2})`
  const colEarlier2 = `${pointEarlier} (${valueName2})`

  const diffCol1 = `Разница (${valueName1})`
  const diffCol2 = `Разница (${valueName2})`

  // Вычисляем разницу для каждой строки: А - Б (ранняя - поздняя)
  return rows.map(row => {
    const valLater1 = Number(row[colLater1]) || 0
    const valEarlier1 = Number(row[colEarlier1]) || 0
    const valLater2 = Number(row[colLater2]) || 0
    const valEarlier2 = Number(row[colEarlier2]) || 0

    // Формула: А - Б (ранняя - поздняя)
    // Если значение уменьшилось → положительное число
    const diff1 = valEarlier1 - valLater1
    const diff2 = valEarlier2 - valLater2

    return {
      ...row,
      [diffCol1]: diff1,
      [diffCol2]: diff2,
    }
  })
}

/**
 * Фильтр строк где Разница (Зн.1) < 0
 * @param {any[]} rows - Массив строк данных
 * @param {string} valueName1 - Название столбца значений из таблицы 1
 * @returns {any[]} Отфильтрованный массив
 */
function filterNegative(rows, valueName1) {
  const diffCol = `Разница (${valueName1})`

  return rows.filter(row => {
    const diff = row[diffCol]
    return diff !== undefined && diff < 0
  })
}

/**
 * Сортировать по убыванию Разница (Зн.2)
 * @param {any[]} rows - Массив строк данных
 * @param {string} valueName2 - Название столбца значений из таблицы 2
 * @returns {any[]} Отсортированный массив
 */
function sortByDifference(rows, valueName2) {
  const diffCol = `Разница (${valueName2})`

  return [...rows].sort((a, b) => {
    const diffA = Number(a[diffCol]) || 0
    const diffB = Number(b[diffCol]) || 0
    return diffB - diffA
  })
}

/**
 * Топ-N по Разница (Зн.2) по убыванию
 * @param {any[]} rows - Массив строк данных
 * @param {string} valueName2 - Название столбца значений из таблицы 2
 * @param {number} limit - Количество записей (по умолчанию 10)
 * @returns {any[]} Топ-N записей
 */
function getTopN(rows, valueName2, limit = 10) {
  const diffCol = `Разница (${valueName2})`

  // Сортировка по убыванию
  const sorted = [...rows].sort((a, b) => {
    const diffA = Number(a[diffCol]) || 0
    const diffB = Number(b[diffCol]) || 0
    return diffB - diffA
  })

  // Берём первые N
  return sorted.slice(0, limit)
}

/**
 * Топ-10 по Разница (Зн.2) по убыванию
 * @param {any[]} rows - Массив строк данных
 * @param {string} valueName2 - Название столбца значений из таблицы 2
 * @returns {any[]} Топ-10 записей
 */
function getTop10(rows, valueName2) {
  return getTopN(rows, valueName2, 10)
}

/**
 * Добавить столбцы разницы для сценария "Новые данные"
 * Вычисляет только Разница (Зн.1), Разница (Зн.2) не считаем
 *
 * @param {any[]} rows - Массив строк данных
 * @param {string[]} headers - Массив заголовков
 * @param {string} valueName1 - Название столбца значений из таблицы 1
 * @param {string} valueName2 - Название столбца значений из таблицы 2
 * @param {string} pointLater - Более поздняя дата в формате DD.MM.YY HH:MM
 * @param {string} pointEarlier - Более ранняя дата в формате DD.MM.YY HH:MM
 * @returns {any[]} Данные с добавленными столбцами разницы
 */
function addDifferenceColumnsForNewData(rows, headers, valueName1, valueName2, pointLater, pointEarlier) {
  // Для новых данных разница уже посчитана в mergeTablesWithValue2Lookup
  // Эта функция нужна для совместимости
  return rows;
}

/**
 * Сортировать по убыванию Б(val2)
 * @param {any[]} rows - Массив строк данных
 * @param {string} valueName2 - Название столбца значений из таблицы 2
 * @param {string} pointB - Дата точки Б
 * @returns {any[]} Отсортированный массив
 */
function sortByValue2(rows, valueName2, pointB) {
  const value2Col = `${pointB} (${valueName2})`

  return [...rows].sort((a, b) => {
    const valA = Number(a[value2Col]) || 0
    const valB = Number(b[value2Col]) || 0
    return valB - valA // По убыванию
  })
}

/**
 * Топ-10 по Б(val2) (по убыванию)
 * @param {any[]} rows - Массив строк данных
 * @param {string} valueName2 - Название столбца значений из таблицы 2
 * @param {string} pointB - Дата точки Б
 * @returns {any[]} Топ-10 записей
 */
function getTop10ByValue2(rows, valueName2, pointB) {
  const sorted = sortByValue2(rows, valueName2, pointB)
  return sorted.slice(0, 10)
}

/**
 * Добавить столбцы разницы для сценария 1
 * Формула: Б - А (поздняя - ранняя)
 *
 * @param {any[]} rows - Массив строк данных
 * @param {string} ccsrName - Название столбца CCSR
 * @param {string} rateName - Название столбца Rate
 * @param {string} pointA - Дата точки А
 * @param {string} pointB - Дата точки Б
 * @returns {any[]} Данные с добавленными столбцами разницы
 */
function addDifferenceColumnsScenario1(rows, ccsrName, rateName, pointA, pointB) {
  const colA1 = `${pointA} (${ccsrName})`
  const colB1 = `${pointB} (${ccsrName})`
  const colA2 = `${pointA} (${rateName})`
  const colB2 = `${pointB} (${rateName})`

  const diffCcsr = `Изменение (${ccsrName})`
  const diffRate = `Изменение (${rateName})`

  // Вычисляем разницу для каждой строки: Б - А
  return rows.map(row => {
    const valA1 = Number(row[colA1]) || 0
    const valB1 = Number(row[colB1]) || 0
    const valA2 = Number(row[colA2]) || 0
    const valB2 = Number(row[colB2]) || 0

    // Формула: Б - А
    // Для CCSR всегда обычная разница (нужна для фильтрации отрицательных)
    const diff1 = valB1 - valA1
    const diff2 = valB2 - valA2

    return {
      ...row,
      [diffCcsr]: diff1,
      [diffRate]: diff2,
    }
  })
}

/**
 * Фильтр строк где Разница (CCSR) < 0
 * @param {any[]} rows - Массив строк данных
 * @param {string} ccsrName - Название столбца CCSR
 * @returns {any[]} Отфильтрованный массив
 */
function filterNegativeByCcsr(rows, ccsrName) {
  const diffCol = `Изменение (${ccsrName})`

  return rows.filter(row => {
    const diff = row[diffCol]
    return diff !== undefined && diff < 0
  })
}

/**
 * Сортировать по убыванию Разница (Rate)
 * @param {any[]} rows - Массив строк данных
 * @param {string} rateName - Название столбца Rate
 * @returns {any[]} Отсортированный массив
 */
function sortByDifferenceRate(rows, rateName) {
  const diffCol = `Изменение (${rateName})`

  return [...rows].sort((a, b) => {
    const diffA = Number(a[diffCol]) || 0
    const diffB = Number(b[diffCol]) || 0
    return diffB - diffA
  })
}

/**
 * Топ-10 по Разница (Rate) по убыванию
 * @param {any[]} rows - Массив строк данных
 * @param {string} rateName - Название столбца Rate
 * @returns {any[]} Топ-10 записей
 */
function getTop10ByDifferenceRate(rows, rateName) {
  const sorted = sortByDifferenceRate(rows, rateName)
  return sorted.slice(0, 10)
}

/**
 * Добавить столбец разницы для сценария 3 (только CCSR, без Rate)
 * Формула: Б - А
 *
 * @param {any[]} rows - Массив строк данных
 * @param {string} ccsrName - Название столбца CCSR
 * @param {string} pointA - Дата точки А
 * @param {string} pointB - Дата точки Б
 * @returns {any[]} Данные с добавленным столбцом разницы
 */
function addDifferenceCcsrScenario3(rows, ccsrName, pointA, pointB) {
  const colA = `${pointA} (${ccsrName})`
  const colB = `${pointB} (${ccsrName})`
  const diffCcsr = `Изменение (${ccsrName})`

  // Вычисляем разницу для каждой строки: Б - А
  return rows.map(row => {
    const valA = Number(row[colA]) || 0
    const valB = Number(row[colB]) || 0

    // Формула: Б - А
    const diff = valB - valA

    return {
      ...row,
      [diffCcsr]: diff,
    }
  })
}

/**
 * Сортировать по убыванию Rate
 * @param {any[]} rows - Массив строк данных
 * @param {string} rateName - Название столбца Rate
 * @returns {any[]} Отсортированный массив
 */
function sortByRate(rows, rateName) {
  return [...rows].sort((a, b) => {
    const valA = Number(a[rateName]) || 0
    const valB = Number(b[rateName]) || 0
    return valB - valA  // По убыванию
  })
}

/**
 * Топ-10 по Rate по убыванию
 * @param {any[]} rows - Массив строк данных
 * @param {string} rateName - Название столбца Rate
 * @returns {any[]} Топ-10 записей
 */
function getTop10ByRate(rows, rateName) {
  const sorted = sortByRate(rows, rateName)
  return sorted.slice(0, 10)
}

module.exports = {
  addDifferenceColumns,
  addDifferenceColumnsForNewData,
  addDifferenceColumnsScenario1,
  addDifferenceCcsrScenario3,
  sortByDifference,
  sortByDifferenceRate,
  sortByRate,
  sortByValue2,
  filterNegative,
  filterNegativeByCcsr,
  getTopN,
  getTop10,
  getTop10ByValue2,
  getTop10ByDifferenceRate,
  getTop10ByRate,
}
