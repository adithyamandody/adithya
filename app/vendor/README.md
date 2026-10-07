# Vendored, not installed

`pdf.min.mjs` and `pdf.worker.min.mjs` are copied from `pdfjs-dist` rather than
imported from `node_modules`, because this app has **no bundler** — the browser
loads these files directly, and `npm install` output is not served.

- **Source:** pdfjs-dist 6.4.299, files `build/pdf.min.mjs` and `build/pdf.worker.min.mjs`
- **Licence:** Apache-2.0, Mozilla Foundation
- **Used for:** pulling the text out of a PDF so the reader can speak it

To update: `npm i pdfjs-dist@latest`, copy both files here again, and check the
reader still opens a PDF. Both are listed in `app/sw.js` and
`scripts/build-www.mjs`; the manifest test fails if they are not.
