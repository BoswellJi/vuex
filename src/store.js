import applyMixin from './mixin'
import devtoolPlugin from './plugins/devtool'
import ModuleCollection from './module/module-collection'
import { forEachValue, isObject, isPromise, assert, partial } from './util'

let Vue // bind on install

/**
 * 数据存储
 */
export class Store {
  /**
   * 实例化Store类型的构造函数
   * @param {*} options Store类型的配置参数
   */
  constructor (options = {}) {
    // 如果没有完成并且window有Vue属性就自动安装
    // Auto install if it is not done yet and `window` has `Vue`.
    // 允许用户避免自动安装在一些案例中
    // To allow users to avoid auto-installation in some cases,
    // 这个代码应该被放在这里
    // this code should be placed here. See #731
    // 全局Vue对象不存在 && window对象存在 && window对象上有Vue属性 
    if (!Vue && typeof window !== 'undefined' && window.Vue) {
      // 可以安装Vuex插件到Vue
      install(window.Vue)
    }

    if (__DEV__) {
      assert(Vue, `must call Vue.use(Vuex) before creating a store instance.`)
      assert(typeof Promise !== 'undefined', `vuex requires a Promise polyfill in this browser.`)
      assert(this instanceof Store, `store must be called with the new operator.`)
    }

    // vuex插件
    const {
      plugins = [],
      strict = false
    } = options

    // Store 对象的内部属性
    // store internal state
    // 内部提交状态
    this._committing = false
    
    this._actions = Object.create(null)
    
    this._actionSubscribers = []
    
    this._mutations = Object.create(null)
    
    this._wrappedGetters = Object.create(null)
    // 根据options配置进行模块注册（整个store模块集合） （创建store模块集合
    this._modules = new ModuleCollection(options)
    // 模块于名称空间映射
    this._modulesNamespaceMap = Object.create(null)
    // 订阅者
    this._subscribers = []
    // 监视者
    this._watcherVM = new Vue()
    // 本地Getter缓存
    this._makeLocalGettersCache = Object.create(null)

    // bind commit and dispatch to self
    const store = this
    // 装饰器模式，给一个方法添加其他操作
    const { dispatch, commit } = this
    this.dispatch = function boundDispatch (type, payload) {
      return dispatch.call(store, type, payload)
    }
    this.commit = function boundCommit (type, payload, options) {
      return commit.call(store, type, payload, options)
    }

    // strict mode
    this.strict = strict

    // 获取根store module 的 state， 模块集合中根 state 
    const state = this._modules.root.state

    // init root module. 初始化根模块
    // this also recursively registers all sub-modules 还会递归注册所有子模块
    // and collects all module getters inside this._wrappedGetters 收集所有模块的getters
    // 参数： Store类型实例 ， state , [] , store 的根模块
    installModule(this, state, [], this._modules.root)

    // 初始化负责相应的stroe vm
    // initialize the store vm, which is responsible for the reactivity
    // 还注册 _wrappedGetters 作为计算属性
    // (also registers _wrappedGetters as computed properties)
    // Store类型实例 根state
    resetStoreVM(this, state)

    // apply plugins
    // 在Vuex中应用的插件
    plugins.forEach(plugin => plugin(this))

    // 是否开启开发工具调试 devtools不为undefined，返回配置参数 否者根据vue框架配置来
    const useDevtools = options.devtools !== undefined ? options.devtools : Vue.config.devtools
    if (useDevtools) {
      // 初始化开发者工具插件
      devtoolPlugin(this)
    }
  }


  // 获取整个store的状态,只读
  get state () {
    return this._vm._data.$$state
  }

  set state (v) {
    if (__DEV__) {
      assert(false, `use store.replaceState() to explicit replace store state.`)
    }
  }

  /**
   * 触发同步更新数据
   * @param {*} _type 
   * @param {*} _payload 
   * @param {*} _options 
   */
  commit (_type, _payload, _options) {
    // check object-style commit
    const {
      type,
      payload,
      options
    } = unifyObjectStyle(_type, _payload, _options)

    const mutation = { type, payload }
    const entry = this._mutations[type]
    if (!entry) {
      if (__DEV__) {
        console.error(`[vuex] unknown mutation type: ${type}`)
      }
      return
    }
    this._withCommit(() => {
      entry.forEach(function commitIterator (handler) {
        handler(payload)
      })
    })

    this._subscribers
      .slice() // shallow copy to prevent iterator invalidation if subscriber synchronously calls unsubscribe
      .forEach(sub => sub(mutation, this.state))

    if (
      __DEV__ &&
      options && options.silent
    ) {
      console.warn(
        `[vuex] mutation type: ${type}. Silent option has been removed. ` +
        'Use the filter functionality in the vue-devtools'
      )
    }
  }

  /**
   * action 类型 数据
   * @param {*} _type 
   * @param {*} _payload 
   */
  dispatch (_type, _payload) {
    // check object-style dispatch
    const {
      type,
      payload
    } = unifyObjectStyle(_type, _payload)

    const action = { type, payload }
    const entry = this._actions[type]
    // 不存在的action 类型
    if (!entry) {
      if (__DEV__) {
        console.error(`[vuex] unknown action type: ${type}`)
      }
      return
    }

    try {
      this._actionSubscribers
        .slice() // shallow copy to prevent iterator invalidation if subscriber synchronously calls unsubscribe
        .filter(sub => sub.before)
        .forEach(sub => sub.before(action, this.state))
    } catch (e) {
      if (__DEV__) {
        console.warn(`[vuex] error in before action subscribers: `)
        console.error(e)
      }
    }

    const result = entry.length > 1
      ? Promise.all(entry.map(handler => handler(payload)))
      : entry[0](payload)

    return new Promise((resolve, reject) => {
      result.then(res => {
        try {
          this._actionSubscribers
            .filter(sub => sub.after)
            .forEach(sub => sub.after(action, this.state))
        } catch (e) {
          if (__DEV__) {
            console.warn(`[vuex] error in after action subscribers: `)
            console.error(e)
          }
        }
        resolve(res)
      }, error => {
        try {
          this._actionSubscribers
            .filter(sub => sub.error)
            .forEach(sub => sub.error(action, this.state, error))
        } catch (e) {
          if (__DEV__) {
            console.warn(`[vuex] error in error action subscribers: `)
            console.error(e)
          }
        }
        reject(error)
      })
    })
  }

  subscribe (fn, options) {
    return genericSubscribe(fn, this._subscribers, options)
  }

  subscribeAction (fn, options) {
    const subs = typeof fn === 'function' ? { before: fn } : fn
    return genericSubscribe(subs, this._actionSubscribers, options)
  }

  watch (getter, cb, options) {
    if (__DEV__) {
      assert(typeof getter === 'function', `store.watch only accepts a function.`)
    }
    return this._watcherVM.$watch(() => getter(this.state, this.getters), cb, options)
  }

  /**
   * 替换State
   * @param {*} state 新state
   */
  replaceState (state) {
    this._withCommit(() => {
      // 重新替换状态
      this._vm._data.$$state = state
    })
  }

  /**
   * 
   * @param {*} path 模块路径
   * @param {*} rawModule 原始模块
   * @param {*} options 配置选项
   */
  registerModule (path, rawModule, options = {}) {
    // 路径为字符串，处理为数组
    if (typeof path === 'string') path = [path]

    if (__DEV__) {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
      // 不能使用registerModule来注册根模块
      assert(path.length > 0, 'cannot register the root module by using registerModule.')
    }

    // 调用模块集合的register方法，注册到指定路径上去
    this._modules.register(path, rawModule)
    // store实例, state, 模块路径， 获取模块， 保护状态 
    installModule(this, this.state, path, this._modules.get(path), options.preserveState)
    // reset store to update getters...
    // 重置storevm store实例, state
    resetStoreVM(this, this.state)
  }

  unregisterModule (path) {
    if (typeof path === 'string') path = [path]

    if (__DEV__) {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
    }

    this._modules.unregister(path)
    this._withCommit(() => {
      const parentState = getNestedState(this.state, path.slice(0, -1))
      Vue.delete(parentState, path[path.length - 1])
    })
    resetStore(this)
  }

  hasModule (path) {
    if (typeof path === 'string') path = [path]

    if (__DEV__) {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
    }

    return this._modules.isRegistered(path)
  }

  hotUpdate (newOptions) {
    this._modules.update(newOptions)
    resetStore(this, true)
  }

  _withCommit (fn) {
    // 提交状态
    const committing = this._committing
    // 正在提交
    this._committing = true
    fn()
    // 提交成功
    this._committing = committing
  }
}

function genericSubscribe (fn, subs, options) {
  if (subs.indexOf(fn) < 0) {
    options && options.prepend
      ? subs.unshift(fn)
      : subs.push(fn)
  }
  // 返回订阅信息，进行删除使用
  return () => {
    // 存在就删除
    const i = subs.indexOf(fn)
    if (i > -1) {
      subs.splice(i, 1)
    }
  }
}

/**
 * 重置仓库
 * @param {*} store 
 * @param {*} hot 
 */
function resetStore (store, hot) {
  // 
  store._actions = Object.create(null)
  store._mutations = Object.create(null)
  store._wrappedGetters = Object.create(null)
  store._modulesNamespaceMap = Object.create(null)
  const state = store.state
  // init all modules
  installModule(store, state, [], store._modules.root, true)
  // reset vm
  resetStoreVM(store, state, hot)
}

/**
 * 重置store vm
 * @param {*} store Store 实例
 * @param {*} state 根Store模块的 state
 * @param {*} hot 
 */
function resetStoreVM (store, state, hot) {
  // 获取Vue实例
  const oldVm = store._vm

  // bind store public getters
  // 设置getters属性
  store.getters = {}
  // reset local getters cache
  // 重置本地getter缓存
  store._makeLocalGettersCache = Object.create(null)
  // 获取store的getter包装，数量相等
  const wrappedGetters = store._wrappedGetters
  const computed = {}
  // 遍历getters getter
  forEachValue(wrappedGetters, (fn, key) => {
    // 
    // use computed to leverage its lazy-caching mechanism
    // direct inline function use will lead to closure preserving oldVm.
    // using partial to return function with only arguments preserved in closure environment.
    // 计算属性 返回方法, store会传入getter函数中
    computed[key] = partial(fn, store)
    // 将包装getter 定义到 store.getters对象上
    Object.defineProperty(store.getters, key, {
      // 返回computed属性
      get: () => store._vm[key],
      enumerable: true // for local getters
    })
  })

  // 使用一个Vue实例存储state树
  // use a Vue instance to store the state tree
  // 
  // suppress warnings just in case the user has added
  // some funky global mixins
  const silent = Vue.config.silent
  Vue.config.silent = true
  // 实例化一个Vue实例
  store._vm = new Vue({
    data: {
      $$state: state
    },
    computed
  })
  Vue.config.silent = silent

  // enable strict mode for new vm
  if (store.strict) {
    enableStrictMode(store)
  }

  // 存在老的Vue实例
  if (oldVm) {
    if (hot) {
      // 给所有订阅的监视者发送改变
      // dispatch changes in all subscribed watchers
      // 强迫他们用于热加载  重新计算getter
      // to force getter re-evaluation for hot reloading.
      store._withCommit(() => {
        // 销毁老状态
        oldVm._data.$$state = null
      })
    }
    // 销毁掉
    Vue.nextTick(() => oldVm.$destroy())
  }
}

/**
 * 安装模块
 * @param {*} store Store 实例
 * @param {*} rootState 根状态
 * @param {*} path []
 * @param {*} module 根模块 
 * @param {*} hot undefined(初始化时)
 */
function installModule (store, rootState, path, module, hot) {
  // path没有路径，意味这当前为根路径
  const isRoot = !path.length
  // 在模块中获取指定命名空间
  const namespace = store._modules.getNamespace(path)

  // register in namespace map
  // 模块有命名空间
  if (module.namespaced) {
    if (store._modulesNamespaceMap[namespace] && __DEV__) {
      console.error(`[vuex] duplicate namespace ${namespace} for the namespaced module ${path.join('/')}`)
    }
    // 模块名称空间映射关系
    store._modulesNamespaceMap[namespace] = module
  }

  // set state 非根模块 && 
  if (!isRoot && !hot) {
    // 获取嵌套下的父模块状态 [a,b] 根据路径找到b模块的父模块a的state
    const parentState = getNestedState(rootState, path.slice(0, -1))
    // 获取最后一个模块名(即为指定的模块名称)
    const moduleName = path[path.length - 1]
    store._withCommit(() => {
      if (__DEV__) {
        if (moduleName in parentState) {
          // 某模块的state 字段，被一个模块使用相同的名称重写了
          console.warn(
            `[vuex] state field "${moduleName}" was overridden by a module with the same name at "${path.join('.')}"`
          )
        }
      }
      // 给父模块状态设置子类模块名的成员
      Vue.set(parentState, moduleName, module.state)
    })
  }

  // Store实例 名称空间 路径
  /**
   * { dispatch, commit,getters, state  } 对象
   * 
   */
  const local = module.context = makeLocalContext(store, namespace, path)

  // 对模块Mutation进行遍历 （对mutation对象进行遍历）
  module.forEachMutation((mutation, key) => {
    // 命名空间类型，命名空间 + 键值
    const namespacedType = namespace + key
    // 对突变配置进行注册， 参数： Store实例， 名称空间 ， 突变函数， 对象
    registerMutation(store, namespacedType, mutation, local)
  })

  // 对模块Action进行遍历 actions对象的 （value, key）
  module.forEachAction((action, key) => {
    // action的root属性是否存在？ key 
    const type = action.root ? key : namespace + key
    // action的handler属性
    const handler = action.handler || action
    // 注册action
    registerAction(store, type, handler, local)
  })

  // 对模块Getter进行遍历
  module.forEachGetter((getter, key) => {
    // 命名空间 +  getter的键
    const namespacedType = namespace + key
    // 注册getter方法 
    registerGetter(store, namespacedType, getter, local)
  })

  // 对模块进行遍历
  module.forEachChild((child, key) => {
    installModule(store, rootState, path.concat(key), child, hot)
  })
}

/**
 * 制造本地 dispatch commit gettes 和state
 * make localized dispatch, commit, getters and state
 * 如果没有命名空间 只使用根模块
 * if there is no namespace, just use root ones
 */
function makeLocalContext (store, namespace, path) {
  const noNamespace = namespace === ''

  const local = {
    // 发送事件 没有名称空间 ？ 直接调用dispatch  : 有名臣空间
    dispatch: noNamespace ? store.dispatch : (_type, _payload, _options) => {
      // 统一对象风格
      const args = unifyObjectStyle(_type, _payload, _options)
      // 获取对象
      const { payload, options } = args
      // dispatch类型
      let { type } = args
      /**
       * options 不存在 || options不存在root属性
       */
      if (!options || !options.root) {
        // 
        type = namespace + type
        if (__DEV__ && !store._actions[type]) {
          console.error(`[vuex] unknown local action type: ${args.type}, global type: ${type}`)
          return
        }
      }
      // dispatch('moduleName/actionName')
      return store.dispatch(type, payload)
    },
    // 提交
    commit: noNamespace ? store.commit : (_type, _payload, _options) => {
      const args = unifyObjectStyle(_type, _payload, _options)
      const { payload, options } = args
      let { type } = args

      if (!options || !options.root) {
        type = namespace + type
        if (__DEV__ && !store._mutations[type]) {
          console.error(`[vuex] unknown local mutation type: ${args.type}, global type: ${type}`)
          return
        }
      }
      // 执行提交
      store.commit(type, payload, options)
    }
  }

  // getters and state object must be gotten lazily
  // because they will be changed by vm update
  // 给local定义 getters属性和state属性
  Object.defineProperties(local, {
    getters: {
      get: noNamespace
        ? () => store.getters
        : () => makeLocalGetters(store, namespace)
    },
    // this.$store.state.a.
    state: {
      get: () => getNestedState(store.state, path)
    }
  })

  return local
}

/**
 * 制作本得getter
 * @param {*} store 
 * @param {*} namespace 
 */
function makeLocalGetters (store, namespace) {
  // getters缓存中不存在的名称空间
  if (!store._makeLocalGettersCache[namespace]) {
    // 声明gettersProxy 对象
    const gettersProxy = {}
    // 获取名称空间的长度
    const splitPos = namespace.length
    // 获取getters的key,进行对象遍历
    Object.keys(store.getters).forEach(type => {
      // skip if the target getter is not match this namespace
      // 判断名称空间，不行同的直接返回
      if (type.slice(0, splitPos) !== namespace) return

      // extract local getter type
      // getter的键
      const localType = type.slice(splitPos)

      // Add a port to the getters proxy.
      // Define as getter property because
      // we do not want to evaluate the getters in this time.
      // 将getter键定义到gettersProxy上
      Object.defineProperty(gettersProxy, localType, {
        // 还是从store.getters上获取
        get: () => store.getters[type],
        enumerable: true
      })
    })
    // 将getters对象赋值给名称空间属性
    store._makeLocalGettersCache[namespace] = gettersProxy
  }
// 返回
  return store._makeLocalGettersCache[namespace]
}

/**
 * 注册突变
 * @param {*} store 
 * @param {*} type 
 * @param {*} handler 
 * @param {*} local 
 */
function registerMutation (store, type, handler, local) {
  // 是否存在指定类型的突变配置
  const entry = store._mutations[type] || (store._mutations[type] = [])
  // 给mutation回调函数传递参数
  entry.push(function wrappedMutationHandler (payload) {
    handler.call(store, local.state, payload)
  })
}

/**
 * 注册action
 * @param {*} store  实例
 * @param {*} type action的key
 * @param {*} handler action的value
 * @param {*} local 
 */
function registerAction (store, type, handler, local) {
  // store上的_actions每个key是，给同种类型添加handler队列
  const entry = store._actions[type] || (store._actions[type] = [])
  // 函数包装action handler,装饰器模式
  entry.push(function wrappedActionHandler (payload) {
    // handler为定义的Action配置对象中的成员函数
    let res = handler.call(store, {
      // 发送
      dispatch: local.dispatch,
      // 提交
      commit: local.commit,
      // getter
      getters: local.getters,
      // 当前状态
      state: local.state,
      // 根getters
      rootGetters: store.getters,
      // 根state
      rootState: store.state
      // 传递的数据
    }, payload)
    // 包装返回值
    if (!isPromise(res)) {
      // Promise化
      res = Promise.resolve(res)
    }
    if (store._devtoolHook) {
      return res.catch(err => {
        store._devtoolHook.emit('vuex:error', err)
        throw err
      })
    } else {
      return res
    }
  })
}

/**
 * 
 * @param {*} store Store实例
 * @param {*} type 命名空间+键
 * @param {*} rawGetter getter的value
 * @param {*} local 本地
 */
function registerGetter (store, type, rawGetter, local) {
  // 获取store的包裹的Getter对象中的某个（名称空间+键）存在
  if (store._wrappedGetters[type]) {
    if (__DEV__) {
      console.error(`[vuex] duplicate getter key: ${type}`)
    }
    return
  }
  // 没有就新增这个getter
  store._wrappedGetters[type] = function wrappedGetter (store) {
    // Getter配置中的参数，内部状态
    return rawGetter(
      local.state, // local state
      local.getters, // local getters
      store.state, // root state
      store.getters // root getters
    )
  }
}

/**
 * 启用严格模式
 * @param {*} store Store实例
 */
function enableStrictMode (store) {
  // Vue 监听 store 的state 变化，对返回值进行依赖收集
  store._vm.$watch(function () { return this._data.$$state }, () => {
    if (__DEV__) {
      assert(store._committing, `do not mutate vuex store state outside mutation handlers.`)
    }
  }, { deep: true, sync: true })
}

/**
 * 获取嵌套的state
 * @param {*} state 
 * @param {*} path 
 */
function getNestedState (state, path) {
  return path.reduce((state, key) => state[key], state)
}

/**
 * 统一对象风格
 * @param {*} type 
 * @param {*} payload 
 * @param {*} options 
 */
function unifyObjectStyle (type, payload, options) {
  // 是对象 && 存在type属性
  if (isObject(type) && type.type) {
    options = payload
    payload = type
    type = type.type
  }

  if (__DEV__) {
    assert(typeof type === 'string', `expects string as the type, but found ${typeof type}.`)
  }
  // 返回统一的dispatch数据
  return { type, payload, options }
}

/**
 * 将vue 插件安装到 vue的接口
 * @param {*} _Vue Vue构造函数的实例
 */
export function install (_Vue) {
  // 不得重复添加
  if (Vue && _Vue === Vue) {
    if (__DEV__) {
      console.error(
        '[vuex] already installed. Vue.use(Vuex) should be called only once.'
      )
    }
    return
  }
  
  Vue = _Vue
  
  applyMixin(Vue)
}
