/**
 * Get the first item that pass the test
 * by second argument function
 *
 * @param {Array} list
 * @param {Function} f
 * @return {*}
 */
export function find (list, f) {
  // 过滤列表，返回第一个元素
  return list.filter(f)[0]
}

/**
 * Deep copy the given object considering circular structure.
 * This function caches all nested objects and its copies.
 * If it detects circular structure, use cached copy to avoid infinite loop.
 *
 * @param {*} obj 目标对象
 * @param {Array<Object>} cache
 * @return {*}
 */
export function deepCopy (obj, cache = []) {
  // just return if obj is immutable value
  // 等于 null, ||  不是object类型数据，直接返回
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  // if obj is hit, it is in circular structure
  // 获取缓存中与目标对象相等的对象
  const hit = find(cache, c => c.original === obj)
  // 存在，直接返回
  if (hit) {
    return hit.copy
  }

  // 是数组
  const copy = Array.isArray(obj) ? [] : {}
  // put the copy into cache at first
  // because we want to refer it in recursive deepCopy
  // 添加到缓存中
  cache.push({
    original: obj,
    copy
  })

  Object.keys(obj).forEach(key => {
    // 对目标对象进行复制
    copy[key] = deepCopy(obj[key], cache)
  })

  return copy
}

/**
 * 对对象进行遍历
 * forEach for object
 */
export function forEachValue (obj, fn) {
  // 获取对象key,进行遍历，将key,value 分别传入回调函数中
  Object.keys(obj).forEach(key => fn(obj[key], key))
}

/**
 * 
 * @param {*} obj 对象
 */
export function isObject (obj) {
  // 不等于null && 是object类型
  return obj !== null && typeof obj === 'object'
}

export function isPromise (val) {
  // val存在 && 有then方法
  return val && typeof val.then === 'function'
}

export function assert (condition, msg) {
  // 条件不存在
  if (!condition) throw new Error(`[vuex] ${msg}`)
}

export function partial (fn, arg) {
  // 返回函数，将参数作为回调函数的参数
  return function () {
    return fn(arg)
  }
}
