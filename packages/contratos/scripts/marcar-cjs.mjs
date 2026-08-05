// Marca o diretorio de saida CommonJS com { "type": "commonjs" } para que o Node
// interprete os arquivos .js como CJS, mesmo com "type": "module" no pacote raiz.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const destino = resolve(aqui, '../dist/cjs/package.json');

await mkdir(dirname(destino), { recursive: true });
await writeFile(destino, JSON.stringify({ type: 'commonjs' }, null, 2) + '\n', 'utf8');

// eslint-disable-next-line no-console
console.log('Marcador CJS escrito em dist/cjs/package.json');
