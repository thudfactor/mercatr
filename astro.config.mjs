import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import lit from '@astrojs/lit';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [lit()],
  vite: {
    ssr: {
      external: ['@anthropic-ai/sdk', 'commander', 'dotenv'],
    },
    plugins: [fixImportMetaUrl()],
  },
});

/**
 * Vite plugin that replaces import.meta.url-based __dirname patterns
 * in SSR-bundled code with process.cwd()-based resolution.
 *
 * Pipeline modules use:
 *   const __dirname = path.dirname(fileURLToPath(import.meta.url));
 *   const X = path.resolve(__dirname, '../../some/path');
 *
 * After bundling, import.meta.url points into dist/server/ which breaks
 * the relative paths. This plugin rewrites those patterns at build time
 * to use process.cwd() instead, which always points to the project root.
 */
function fixImportMetaUrl() {
  return {
    name: 'fix-import-meta-url',
    transform(code, id) {
      // Only apply to our own source files during SSR build
      if (!id.includes('/src/') || !id.endsWith('.ts')) return null;
      if (!code.includes('import.meta.url')) return null;

      // Replace the __dirname = path.dirname(fileURLToPath(import.meta.url)) pattern
      // with __dirname = process.cwd(), since all relative paths are ../../ (i.e. project root)
      const transformed = code.replace(
        /const __dirname\s*=\s*path\.dirname\(fileURLToPath\(import\.meta\.url\)\);/g,
        'const __dirname = process.cwd(); // patched by astro.config.mjs',
      );

      if (transformed === code) return null;

      // Now ../../prompts/ resolves from cwd → ../../prompts/ is wrong.
      // The original pattern: path.resolve(__dirname, '../../something')
      // With __dirname = cwd, we need path.resolve(cwd, 'something')
      // So strip the ../../ prefix from resolved paths, preserving the original quote.
      const final = transformed.replace(
        /path\.resolve\(__dirname,\s*(['"])\.\.\/\.\.\//g,
        "path.resolve(__dirname, $1",
      );

      return { code: final, map: null };
    },
  };
}
