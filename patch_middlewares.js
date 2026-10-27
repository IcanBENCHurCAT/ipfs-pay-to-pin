const fs = require('fs');

function patchFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  const search = `    ip = c.req.header('x-forwarded-for')?.split(',').pop()?.trim()\n      || c.req.header('x-real-ip');`;

  const replace = `    const forwardedFor = c.req.header('x-forwarded-for');\n    if (forwardedFor) {\n      const parts = forwardedFor.split(',');\n      for (let i = parts.length - 1; i >= 0; i--) {\n        const trimmed = parts[i].trim();\n        if (trimmed) {\n          ip = trimmed;\n          break;\n        }\n      }\n    }\n    ip = ip || c.req.header('x-real-ip');`;

  if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`Patched ${filepath}`);
  } else {
    console.log(`Could not find search string in ${filepath}`);
  }
}

patchFile('src/middleware/rateLimiter.ts');
patchFile('src/middleware/webhookRateLimiter.ts');
patchFile('src/middleware/traceId.ts');
