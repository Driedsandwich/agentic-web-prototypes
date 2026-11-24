# Edition Switch

Edition Switch is a prototype for checking how a change in publishing destination affects the photos on an event flyer. It uses fictional artwork, rights holders, terms, and replies. Everything happens in the page. There are no external requests, AI models, payments, or contracts. Reloading resets the sample.

Serve this directory with any static server and open `index.html` through it. For example, run `python3 -m http.server 8000 --bind 127.0.0.1` and open `http://127.0.0.1:8000/`. No build or packages are needed. Run `node --test` here to test the rules and negotiation flow.

## Try it by hand

1. Start with **Venue handout**. Check that all three placements say **Usable** and **Words used here** is open. Select a photo to inspect its terms.
2. Turn on **Also publish on Web**. Check that the pier remains in place, shows **Not for this use**, and has a print-only condition. In the right panel, compare **Current** with **Proposed**, read the v3 terms, and check the history and request ledger.
3. Choose **Counter** and request a sample reply about April. The terms should change to v4 while the flyer stays the same. A counter asking for Social keeps the previous offer.
4. Choose **Accept**. The flyer should show the new crop and the pier should become **Usable**. **Export credits** downloads a sample text file listing only usable, placed assets for the active destinations.
5. Reload and repeat step 2. Accept v3 directly and check that the original Studio Kite credit appears in the download. Reload again, repeat step 2, and choose **Remove** to check that the pier and its credit disappear.
6. Try **Web**, **Social**, and all three palettes. At 390 pixels wide, check that the terms and controls are reachable without horizontal scrolling.
