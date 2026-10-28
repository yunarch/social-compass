import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  // onnxruntime-web ships its own wasm loader that breaks when pre-bundled.
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
});
