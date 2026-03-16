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

module.exports = {
  addDifferenceColumns,
  addDifferenceColumnsForNewData,
  sortByDifference,
  sortByValue2,
  filterNegative,
  getTopN,
  getTop10,
  getTop10ByValue2,
}
