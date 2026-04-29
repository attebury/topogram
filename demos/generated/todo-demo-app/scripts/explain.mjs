const message = `
Topogram app workflow

1. Edit:
   topogram/
   topogram.project.json

2. Validate:
   npm run check

3. Regenerate:
   npm run generate

4. Verify generated app:
   npm run verify

5. Run locally:
   npm run bootstrap
   npm run dev

Useful inspection:
   npm run check:json
`;

console.log(message.trimEnd());
