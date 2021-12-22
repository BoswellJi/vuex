<template>
  <ul>
    <li v-for="product in products" :key="product.id">
      {{ product.title }} - {{ product.price | currency }}
      <br />
      <button :disabled="!product.inventory" @click="handler(product)">
        Add to cart
      </button>
    </li>
  </ul>
</template>

<script>
import { mapState, mapActions, createNamespacedHelpers } from "vuex";

const cartModule = createNamespacedHelpers('cart');
const productsModule = createNamespacedHelpers('products');

export default {
  computed: {
    ...productsModule.mapState( {
      products: (state) => state.all,
    }),
  },
  methods: {
    ...cartModule.mapActions(["addProductToCart"]),
    ...productsModule.mapActions(["getAllProducts"]),
    handler(item){
      // this.$store.dispatch('cart/addProductToCart',item); // action
      this.$store.commit('cart1MutationFn1'); // commit
    }
  },
  created() {
    this.getAllProducts();
    // this.$store.getters.cart.cartProducts; getters中不能用这种形式，只能使用['cart/cartProducts']
    // this.$store.getters['cartProducts']; // getter
    // this.$store.state.cart; // state
  },
};
</script>
