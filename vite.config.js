import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        dungeon: 'dungeon.html',
        deployment: 'deployment.html',
        battle: 'battle.html',
        ...(mode === 'pages' ? {} : { lab: 'lab.html', materials: 'materials.html' }),
      },
    },
  },
}));
