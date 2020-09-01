export default function (Vue) {
  // 将Vue主版本
  const version = Number(Vue.version.split('.')[0])

  // 大于等于2.x的版本
  if (version >= 2) {
    // 将beforeCreate生命周期方法混合到所有组件中
    Vue.mixin({ beforeCreate: vuexInit })
  } else {
    // 1.x的版本
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
    // store injection，到组件
    if (options.store) {
      // this是组件实例 $store是 Store类的实例
      this.$store = typeof options.store === 'function'
        ? options.store()
        : options.store
        // 配置存在parent && parent存在$store（状态仓库
        // 创建组件的时候，会从根，到叶子，所以Vue类型的实例会有$store属性
    } else if (options.parent && options.parent.$store) {
      // 给当前组件也添加这个属性，实例
      this.$store = options.parent.$store
    }
  }
}
