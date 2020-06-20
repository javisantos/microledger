import { terser } from 'rollup-plugin-terser'
import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs-alternate'
import nodePolyfills from 'rollup-plugin-node-polyfills'
import replace from '@rollup/plugin-replace'

const plugins = () => {
  if (!process.env.PRODUCTION) {
    return [
      resolve({
        preferBuiltins: true,
        browser: true
      }),
      commonjs(),
      nodePolyfills(),
      replace({ 'process.browser': !!process.env.BROWSER })
    ]
  } else {
    return [
      resolve({
        preferBuiltins: true,
        browser: true
      }),
      commonjs(),
      nodePolyfills(),
      replace({ 'process.browser': !!process.env.BROWSER }),
      terser({
        compress: { ecma: 2019 }
      })
    ]
  }
}

export default [{
  input: 'src/browser.js',
  output: [{
    file: 'dist/microledger-iife.js',
    format: 'iife',
    name: 'Microledger',
    sourcemap: !process.env.PRODUCTION
  }, {
    file: 'dist/microledger-esm.js',
    format: 'esm',
    sourcemap: !process.env.PRODUCTION
  }],
  plugins: plugins()

}]
