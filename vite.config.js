import { defineConfig } from 'vite'
import babel from '@rollup/plugin-babel'

export default defineConfig({
  plugins: [
    babel({
      babelHelpers: 'bundled',
      extensions: ['.js', '.jsx'],
      include: ['./**/*'],
      presets: [['@babel/preset-react', { pragma: 'h' }]],
    }),
  ],
})
