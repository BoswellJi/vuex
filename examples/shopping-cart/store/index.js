import Vue from 'vue'
import Vuex from 'vuex'
import cart from './modules/cart'
import products from './modules/products'
import createLogger from '../../../src/plugins/logger'

Vue.use(Vuex)

const debug = process.env.NODE_ENV !== 'production'

export default new Vuex.Store({
  modules: {
    cart,
    products
  },
  getters:{
    cart1Fn1: (state, getters, rootState) => {
          
    },
  },
  strict: debug,
  plugins: debug ? [createLogger()] : []
})
