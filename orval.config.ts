import { defineConfig } from 'orval';

export default defineConfig({
  ipfsPayToPin: {
    output: {
      mode: 'split',
      target: 'typescript-openapi-client/src/api',
      schemas: 'typescript-openapi-client/src/models',
      client: 'axios',
      tsconfig: 'typescript-openapi-client/tsconfig.json',
    },
    input: {
      target: './openapi/openapi.yaml',
    },
  },
});
