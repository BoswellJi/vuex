import { isObject } from './util'

/**
 * 减少vue.js中的代码 获取状态，
 * Reduce the code which written in Vue.js for getting the state.
 * @param {String} [namespace] - Module's namespace
 * @param {Object|Array} states # Object's item can be a function which accept state and getters for param, you can do something for state and getters in it.
 * @param {Object}
 */
export const mapState = normalizeNamespace((namespace, states) => {
  const res = {}
  if (__DEV__ && !isValidMap(states)) {
    console.error('[vuex] mapState: mapper parameter must be either an Array or an Object')
  }
  // 规范会状态字段然后进行遍历
  normalizeMap(states).forEach(({ key, val }) => {
    // state的字段，重写state对象
    res[key] = function mappedState () {
      // store中的 state
      let state = this.$store.state
      // store中的getters
      let getters = this.$store.getters
      // 存在名称空间
      if (namespace) {
        // 根据名称空间获取模块
        const module = getModuleByNamespace(this.$store, 'mapState', namespace)
        // 模块不存在，直接返回
        if (!module) {
          return
        }
        // 从模块获取 state getters 获取local对象上的属性
        state = module.context.state
        getters = module.context.getters
      }
      // val为函数
      return typeof val === 'function'
      // 调用
        ? val.call(this, state, getters)
        // 直接返回state的 对应属性
        : state[val]
    }
    // mark vuex getter for devtools
    res[key].vuex = true
  })
  return res
})

/**
 * 减少用于提交突变的代码的书写
 * Reduce the code which written in Vue.js for committing the mutation
 * @param {String} [namespace] - Module's namespace
 * @param {Object|Array} mutations # Object's item can be a function which accept `commit` function as the first param, it can accept another params. You can commit mutation and do any other things in this function. specially, You need to pass anthor params from the mapped function.
 * @return {Object}
 */
export const mapMutations = normalizeNamespace((namespace, mutations) => {
  const res = {}
  if (__DEV__ && !isValidMap(mutations)) {
    console.error('[vuex] mapMutations: mapper parameter must be either an Array or an Object')
  }
  normalizeMap(mutations).forEach(({ key, val }) => {
    // 重写mutation对象
    res[key] = function mappedMutation (...args) {
      // Get the commit method from store 从store实例中获取commit方法
      let commit = this.$store.commit
      // 根据名称空间获取 module 的 store 上的配置
      if (namespace) {
        const module = getModuleByNamespace(this.$store, 'mapMutations', namespace)
        if (!module) {
          return
        }
        commit = module.context.commit
      }
      return typeof val === 'function'
        ? val.apply(this, [commit].concat(args))
        : commit.apply(this.$store, [val].concat(args))
    }
  })
  return res
})

/**
 * 减少vue.js中写的获取getter的代码
 * Reduce the code which written in Vue.js for getting the getters
 * @param {String} [namespace] - Module's namespace
 * @param {Object|Array} getters
 * @return {Object}
 */
export const mapGetters = normalizeNamespace((namespace, getters) => {
  const res = {}
  if (__DEV__ && !isValidMap(getters)) {
    console.error('[vuex] mapGetters: mapper parameter must be either an Array or an Object')
  }
  normalizeMap(getters).forEach(({ key, val }) => {
    // The namespace has been mutated by normalizeNamespace
    // 名称空间已经被正规化名称空间修改了
    // 名称空间 + getter的key
    val = namespace + val
    res[key] = function mappedGetter () {
      // 存在名称空间 && 没有模块， 直接返回
      if (namespace && !getModuleByNamespace(this.$store, 'mapGetters', namespace)) {
        return
      }
      if (__DEV__ && !(val in this.$store.getters)) {
        console.error(`[vuex] unknown getter: ${val}`)
        return
      }
      // 获取getters上的
      return this.$store.getters[val]
    }
    // mark vuex getter for devtools
    res[key].vuex = true
  })
  return res
})

/**
 * 减少vue.js中为了发送action而写的代码
 * Reduce the code which written in Vue.js for dispatch the action
 * @param {String} [namespace] - Module's namespace
 * @param {Object|Array} actions # Object's item can be a function which accept `dispatch` function as the first param, it can accept anthor params. You can dispatch action and do any other things in this function. specially, You need to pass anthor params from the mapped function.
 * @return {Object}
 */
export const mapActions = normalizeNamespace((namespace, actions) => {
  const res = {}
  if (__DEV__ && !isValidMap(actions)) {
    console.error('[vuex] mapActions: mapper parameter must be either an Array or an Object')
  }
  normalizeMap(actions).forEach(({ key, val }) => {
    res[key] = function mappedAction (...args) {
      // get dispatch function from store
      let dispatch = this.$store.dispatch
      if (namespace) {
        const module = getModuleByNamespace(this.$store, 'mapActions', namespace)
        if (!module) {
          return
        }
        dispatch = module.context.dispatch
      }
      return typeof val === 'function'
        ? val.apply(this, [dispatch].concat(args))
        : dispatch.apply(this.$store, [val].concat(args))
    }
  })
  return res
})

/**
 * 在特定的作用域中用mapXXX函数重新绑定名称空间参数 并且通过简单对象返回他们
 * Rebinding namespace param for mapXXX function in special scoped, and return them by simple object
 * @param {String} namespace
 * @return {Object}
 */
export const createNamespacedHelpers = (namespace) => ({
  mapState: mapState.bind(null, namespace),
  mapGetters: mapGetters.bind(null, namespace),
  mapMutations: mapMutations.bind(null, namespace),
  mapActions: mapActions.bind(null, namespace)
})

/**
 * 标准化
 * Normalize the map
 * normalizeMap([1, 2, 3]) => [ { key: 1, val: 1 }, { key: 2, val: 2 }, { key: 3, val: 3 } ]
 * normalizeMap({a: 1, b: 2, c: 3}) => [ { key: 'a', val: 1 }, { key: 'b', val: 2 }, { key: 'c', val: 3 } ]
 * @param {Array|Object} map
 * @return {Object}
 */
function normalizeMap (map) {
  if (!isValidMap(map)) {
    return []
  }
  return Array.isArray(map)
    ? map.map(key => ({ key, val: key }))
    : Object.keys(map).map(key => ({ key, val: map[key] }))
}

/**
 * 验证map是否有效
 * Validate whether given map is valid or not
 * @param {*} map
 * @return {Boolean}
 */
function isValidMap (map) {
  // 普通对象 || 数组
  return Array.isArray(map) || isObject(map)
}

/**
 * 返回一个期待包含namespace和map两个参数的函数 它会正规化名称空间和之后参数的方法将处理新  namespace和map
 * Return a function expect two param contains namespace and map. it will normalize the namespace and then the param's function will handle the new namespace and the map.
 * @param {Function} fn
 * @return {Function}
 */
function normalizeNamespace (fn) {
  return (namespace, map) => {
    // 不是字符串
    if (typeof namespace !== 'string') {
      // 
      map = namespace
      // 赋值为空
      namespace = ''
      // 最后一个字符串不等于/
    } else if (namespace.charAt(namespace.length - 1) !== '/') {
      // 就加上
      namespace += '/'
    }
    return fn(namespace, map)
  }
}

/**
 * Search a special module from store by namespace. if module not exist, print error message.
 * @param {Object} store
 * @param {String} helper
 * @param {String} namespace
 * @return {Object}
 */
function getModuleByNamespace (store, helper, namespace) {
  const module = store._modulesNamespaceMap[namespace]
  if (__DEV__ && !module) {
    console.error(`[vuex] module namespace not found in ${helper}(): ${namespace}`)
  }
  return module
}
