// window 不为空 
const target = typeof window !== 'undefined'
  ? window
  : typeof global !== 'undefined'
    ? global
    : {}
  // （浏览器插件）调试工具提供钩子函数
const devtoolHook = target.__VUE_DEVTOOLS_GLOBAL_HOOK__

/**
 * 
 * @param {*} store Store实例
 */
export default function devtoolPlugin (store) {
  if (!devtoolHook) return

  // 给store实例添加 _devtoolHook 属性
  store._devtoolHook = devtoolHook

  // 开发者公共提供的生命钩子函数 init
  devtoolHook.emit('vuex:init', store)

  // 状态旅行
  devtoolHook.on('vuex:travel-to-state', targetState => {
    // 修改 store中的状态
    store.replaceState(targetState)
  })

  // 订阅store状态
  store.subscribe((mutation, state) => {
    // 状态变更
    devtoolHook.emit('vuex:mutation', mutation, state)
  }, { prepend: true })

  store.subscribeAction((action, state) => {
    devtoolHook.emit('vuex:action', action, state)
  }, { prepend: true })
}
