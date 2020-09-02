import { forEachValue } from '../util'

// store的模块的基础数据结构，使用一些属性和方法的包
// Base data struct for store's module, package with some attribute and method
export default class Module {
  /**
   * 
   * @param {*} rawModule options 因为每个模块下的配置选项都是相同的
   * @param {*} runtime false
   */
  constructor (rawModule, runtime) {
    this.runtime = runtime
    // 模块下的所有子模块
    // Store some children item
    this._children = Object.create(null)
    // 保存原始的模块配置选项
    // Store the origin module object which passed by programmer
    this._rawModule = rawModule
    // 获取模块配置选项中的state
    const rawState = rawModule.state

    // Store 原始模块的 state 是函数，返回 函数返回值，否者直接使用（object）
    // Store the origin module's state
    this.state = (typeof rawState === 'function' ? rawState() : rawState) || {}
  }

  /**
   * 模块配置选项中是否存在 namespaced字段
   */
  get namespaced () {
    return !!this._rawModule.namespaced
  }

  /**
   * 给store模块添加子模块，因为每个模块配置选项中都是可以有自己的子模块的
   * @param {*} key 
   * @param {*} module 
   */
  addChild (key, module) {
    this._children[key] = module
  }

  /**
   * 删除掉模块中的子模块
   * @param {*} key 
   */
  removeChild (key) {
    delete this._children[key]
  }

  /**
   * 获取子模块
   * @param {*} key 
   */
  getChild (key) {
    return this._children[key]
  }

  hasChild (key) {
    return key in this._children
  }

  update (rawModule) {
    // 原始模块中的名称空间使用新的模块来更新
    this._rawModule.namespaced = rawModule.namespaced
    // 下面更新 actions mutations getters
    if (rawModule.actions) {
      this._rawModule.actions = rawModule.actions
    }
    if (rawModule.mutations) {
      this._rawModule.mutations = rawModule.mutations
    }
    if (rawModule.getters) {
      this._rawModule.getters = rawModule.getters
    }
  }

  /**
   * 遍历每个子模块
   * @param {*} fn 
   */
  forEachChild (fn) {
    forEachValue(this._children, fn)
  }

  /**
   * 遍历每个模块中的getters配置
   * @param {*} fn 
   */
  forEachGetter (fn) {
    if (this._rawModule.getters) {
      forEachValue(this._rawModule.getters, fn)
    }
  }

  /**
   * 遍历每个模块中的action配置
   * @param {*} fn 
   */
  forEachAction (fn) {
    if (this._rawModule.actions) {
      // actions 对象，可以做异步处理， 对对象进行迭代 
      forEachValue(this._rawModule.actions, fn)
    }
  }

  /**
   * 遍历 mutation 配置对象
   * @param {*} fn 
   */
  forEachMutation (fn) {
    if (this._rawModule.mutations) {
      // 获取模块中的mutations 配置参数，fn 为遍历的函数
      forEachValue(this._rawModule.mutations, fn)
    }
  }
}
