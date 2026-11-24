# Benefit Commons

An interactive prototype that estimates benefits in the browser using five fictional rule copies. The copied dates, preflight labels, application addresses, and income limits are sample data. Page assets load from the same static site. Checking, opening a sample preview, and exporting send no data.

Serve this directory from a static web server, then open `index.html` through that server. No build or dependencies are required. Run the pure-function tests with `node --test`.

## Try it by hand

1. Open the page at desktop width. Look for the opening instructions, the open **Words used here** glossary, the arrows into **Your browser**, and the **0** in **Data sent**.
2. Select **Check** with the sample values. Expect **Likely**, **Likely**, **Maybe**, **Likely**, and **Unlikely** in order, each with a shape, reason, source, and copy date. Try **Other state** for five **Maybe** estimates. The language control demonstrates an allowed field and the interface stays in English.
3. Select **Official application** to open an in-page sample preview, then close it. Select **Export checklist** to download a plain text list of sample documents without the entered values.
4. Switch through all three palettes and confirm the selected name appears. At 390 pixels wide, check that the fields and actions fit, the rule sites stack below the browser panel, and the page has no horizontal scrolling.
