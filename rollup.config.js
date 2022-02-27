import fs from 'fs'

import typescript from '@rollup/plugin-typescript'

export default {
  input: 'src/index.ts',
  external: id => !(id.startsWith('.') || id.startsWith('/')),
  output: [
    {
      dir: './dist',
      format: 'es',
      preserveModules: true,
      entryFileNames: 'es/[name].js',
    },
    {
      dir: './dist',
      format: 'cjs',
      preserveModules: true,
      entryFileNames: 'cjs/[name].js',
    },
  ],
  plugins: [
    typescript(),
    {
      writeBundle() {
        fs.writeFileSync('./dist/es/package.json', JSON.stringify({ type: 'module' }, null, '  '))
      },
    },
  ],
}
