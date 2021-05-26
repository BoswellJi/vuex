export default function (Vue) {
  // Vue主版本
  const version = Number(Vue.version.split('.')[0])

  if (version >= 2) {
    Vue.mixin({ beforeCreate: vuexInit })
  } else {
    // override init and inject vuex init procedure
    // for 1.x backwards compatibility.
    const _init = Vue.prototype._init
    Vue.prototype._init = function (options = {}) {
      options.init = options.init
        ? [vuexInit].concat(options.init)
        : vuexInit
      _init.call(this, options)
    }
  }

  /**
   * Vuex init hook, injected into each instances init hooks list.
   * 为了给每个组件都加上$store属性
   */
  function vuexInit () {
    const options = this.$options
    // store injection,当前组件是否存在store属性
    if (options.store) {
      this.$store = typeof options.store === 'function'
        ? options.store()
        : options.store
        // 创建组件的时候，会从根，到叶子，所以Vue类型的实例会有$store属性
    } else if (options.parent && options.parent.$store) {
      this.$store = options.parent.$store
    }
  }
}
