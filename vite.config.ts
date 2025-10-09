import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [],
    root: './',
    publicDir: 'public',
    base: '/vtk-picker/', // must match your GitHub repo name
    build: {
        outDir: 'dist'
    }
});