export default function (Vue) {
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
   */
  function vuexInit () {
    const options = this.$options
    // 在new Vue({store: store})时添加进来store属性
    if (options.store) {
      this.$store = typeof options.store === 'function'
        ? options.store()
        : options.store
        // 安装子组件的时候实例会从根组件获取$store属性
    } else if (options.parent && options.parent.$store) {
      this.$store = options.parent.$store
    }
  }
}
