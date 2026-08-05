import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { VueQueryPlugin, vueQueryOptions } from './plugins/vueQuery';
import './styles/main.css';

const app = createApp(App);

app.use(createPinia());
app.use(VueQueryPlugin, vueQueryOptions);
app.use(router);

app.mount('#app');
