import Module from './module'
import { assert, forEachValue } from '../util'

export default class ModuleCollection {
  constructor(rawRootModule) {
    // register root module (Vuex.Store options)
    this.register([], rawRootModule, false)
  }

  get(path) {
    // 向下找子模块
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

  update(rawRootModule) {
    update([], this.root, rawRootModule)
  }

  /***
   * path的意义：root/mod1name/mod2name,模块树的路径
   */
  register (path, rawModule, runtime = true) {
    if (__DEV__) {
      assertRawModule(path, rawModule)
    }
    // 根模块
    const newModule = new Module(rawModule, runtime)
    if (path.length === 0) {
      this.root = newModule
    } else {
      // 返回子模块的父模块（这里的目的：就是为了找到当前这个模块的父模块）   参数：出去最后一个元素的数组
      const parent = this.get(path.slice(0, -1))
      parent.addChild(path[path.length - 1], newModule)
    }

    // register nested modules 
    if (rawModule.modules) {
      forEachValue(rawModule.modules, (rawChildModule, key /* 模块名 modules:{m1:xxx} =>m1 */) => {
        // [cart,cart1]
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

    if (parent) {
      return parent.hasChild(key)
    }

    return false
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
