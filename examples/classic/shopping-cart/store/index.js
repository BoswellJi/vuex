import { createStore, createLogger } from 'vuex'
import cart from './modules/cart'
import products from './modules/products'

const debug = process.env.NODE_ENV !== 'production'

export default createStore({
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
