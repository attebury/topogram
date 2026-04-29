const message = `
Topogram app workflow

1. Edit:
   topogram/
   topogram.project.json

2. Validate:
   npm run status

3. Regenerate:
   npm run build

4. Verify generated app:
   npm run verify

5. Run locally:
   npm run bootstrap
   npm run dev

Useful inspection:
   npm run inspect
`;

console.log(message.trimEnd());
