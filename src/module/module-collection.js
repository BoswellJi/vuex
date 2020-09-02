import Module from './module'
import { assert, forEachValue } from '../util'

export default class ModuleCollection {
  /**
   * 构造函数
   * @param {*} rawRootModule store的配置选项options
   */
  constructor(rawRootModule) {
    // 注册根模块
    // register root module (Vuex.Store options)
    // 初始化path为 空数组，当前没有模块，当前相当于在注册根模块
    this.register([], rawRootModule, false)
  }

  /**
   * 获取模块
   * @param {*} path 当为空数组时，返回根模块下指定key的子模块
   */
  get(path) {
    // 参数: key 为 path
    // 从根模块开始找到子模块
    // 当数组为空时，返回值为第二个参数的值
    // reduce方法的返回值为第一个参数的，最后值
    return path.reduce((module, key) => {
      return module.getChild(key)
    }, this.root)
  }

  /**
   * 获取命名空间
   * @param {*} path 
   */
  getNamespace(path) {
    // 获取根模块
    let module = this.root
    // 遍历路径
    return path.reduce((namespace, key) => {
      // 获取对应模块（根据父级模块找到子级模块
      module = module.getChild(key)
      // 获取store模块的命名空间字段是否存在？存在就返回
      return namespace + (module.namespaced ? key + '/' : '')
    }, '')
  }

  // 跟新模块
  update(rawRootModule) {
    update([], this.root, rawRootModule)
  }

  register (path, rawModule, runtime = true) {
    if (__DEV__) {
      assertRawModule(path, rawModule)
    }
    // 创建新模块 参数：options 
    const newModule = new Module(rawModule, runtime)
    // 当前没有模块的路径信息，意味着在注册根模块
    if (path.length === 0) {
      this.root = newModule
    } else {
      // 返回子模块的父模块（这里的目的：就是为了找到当前这个模块的父模块）   参数：出去最后一个元素的数组
      const parent = this.get(path.slice(0, -1))
      // 将子模块添加到父模块中去 参数：最后一个模块名称，
      parent.addChild(path[path.length - 1], newModule)
    }

    // register nested modules 
    // 注册嵌套模块 获取配置选项中额modules参数，如果有其他模块，进行迭代注册
    if (rawModule.modules) {
      // 遍历每个store 模块，给每个进行注册 [] 参数，每个子store module
      forEachValue(rawModule.modules, (rawChildModule, key) => {
        // 对每个子模块进行注册： 参数： 给根模块注册子模块 [a,b]: 第一个元素是 根模块的子模块，第二个元素是，子模块的子模块，会在当前的模块中递归下去，直到结束；
        // concat方法不会对原始数组进行改变
        this.register(path.concat(key), rawChildModule, runtime)
      })
    }
  }

  /**
   * 取消注册
   * @param {*} path [a,b]
   */
  unregister(path) {
    // 根据模块路径获取最后一个模块的父模块
    const parent = this.get(path.slice(0, -1))
    // 从最后一个模块名
    const key = path[path.length - 1]
    const child = parent.getChild(key)

    if (!child) {
      if (__DEV__) {
        console.warn(
          `[vuex] trying to unregister module '${key}', which is ` +
          `not registered`
        )
      }
      return
    }

    if (!child.runtime) {
      return
    }

    parent.removeChild(key)
  }

  isRegistered (path) {
    const parent = this.get(path.slice(0, -1))
    const key = path[path.length - 1]

    return parent.hasChild(key)
  }
}

function update (path, targetModule, newModule) {
  if (__DEV__) {
    assertRawModule(path, newModule)
  }

  // update target module，更新方式在模块实例当中
  targetModule.update(newModule)

  // update nested modules 更新模块的嵌套模块
  if (newModule.modules) {
    // 遍历模块的子模块
    for (const key in newModule.modules) {
      // 在被替换模块中不存在新模块的子模块
      if (!targetModule.getChild(key)) {
        if (__DEV__) {
          console.warn(
            `[vuex] trying to add a new module '${key}' on hot reloading, ` +
            'manual reload is needed'
          )
        }
        return
      }
      // 否则，直接更新
      update(
        path.concat(key), // 子模块的名称
        targetModule.getChild(key), // 被更新模块下的对应子模块
        newModule.modules[key] // 新模块下的对应新模块
      )
    }
  }
}

const functionAssert = {
  assert: value => typeof value === 'function',
  expected: 'function'
}

const objectAssert = {
  assert: value => typeof value === 'function' ||
    (typeof value === 'object' && typeof value.handler === 'function'),
  expected: 'function or object with "handler" function'
}

const assertTypes = {
  getters: functionAssert,
  mutations: functionAssert,
  actions: objectAssert
}

function assertRawModule(path, rawModule) {
  Object.keys(assertTypes).forEach(key => {
    if (!rawModule[key]) return

    const assertOptions = assertTypes[key]

    forEachValue(rawModule[key], (value, type) => {
      assert(
        assertOptions.assert(value),
        makeAssertionMessage(path, key, type, value, assertOptions.expected)
      )
    })
  })
}

function makeAssertionMessage(path, key, type, value, expected) {
  let buf = `${key} should be ${expected} but "${key}.${type}"`
  if (path.length > 0) {
    buf += ` in module "${path.join('.')}"`
  }
  buf += ` is ${JSON.stringify(value)}.`
  return buf
}
