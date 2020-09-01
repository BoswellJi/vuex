// Credits: borrowed code from fcomb/redux-logger

import { deepCopy } from '../util'

export default function createLogger ({
  collapsed = true,
  filter = (mutation, stateBefore, stateAfter) => true,
  transformer = state => state,
  mutationTransformer = mut => mut,
  logger = console
} = {}) {
  return store => {
    // 拷贝当前的状态对象
    let prevState = deepCopy(store.state)

    // 订阅store对象
    store.subscribe((mutation, state) => {
      // logger 日志打印器 不存在，直接返回
      if (typeof logger === 'undefined') {
        return
      }
      // 变化后的状态
      const nextState = deepCopy(state)
      // 默认过滤方法返回true
      if (filter(mutation, prevState, nextState)) {
        // 当前日期
        const time = new Date()
        // 格式化日期
        const formattedTime = ` @ ${pad(time.getHours(), 2)}:${pad(time.getMinutes(), 2)}:${pad(time.getSeconds(), 2)}.${pad(time.getMilliseconds(), 3)}`
        // mutation转换器
        const formattedMutation = mutationTransformer(mutation)
        // 日志信息 改变的类型
        const message = `mutation ${mutation.type}${formattedTime}`
        const startMessage = collapsed
          ? logger.groupCollapsed
          : logger.group

        // render
        try {
          startMessage.call(logger, message)
        } catch (e) {
          console.log(message)
        }

        logger.log('%c prev state', 'color: #9E9E9E; font-weight: bold', transformer(prevState))
        logger.log('%c mutation', 'color: #03A9F4; font-weight: bold', formattedMutation)
        logger.log('%c next state', 'color: #4CAF50; font-weight: bold', transformer(nextState))

        try {
          logger.groupEnd()
        } catch (e) {
          logger.log('—— log end ——')
        }
      }

      // 处理之后，将变更后的状态，赋值给前一个状态
      prevState = nextState
    })
  }
}

/**
 * 重复字符串
 * @param {*} str 
 * @param {*} times 
 */
function repeat (str, times) {
  // 将指定数量的数组的空元素进行连接
  return (new Array(times + 1)).join(str)
}
// 给数字填充0
function pad (num, maxLength) {
  return repeat('0', maxLength - num.toString().length) + num
}
