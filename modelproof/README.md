# Modelproof

A static prototype for testing an agent graph across models, inspecting failures,
and exporting a compatibility declaration. The ferry graph, model names, run
records, addresses, and budget figures are samples. The page sends no input
anywhere, runs no AI models, and costs nothing.

Serve this directory as static files and open `index.html` in a modern browser.
Use a browser that supports ES modules and JSON imports. A local preview can be
served with `python3 -m http.server` from this directory. There's no build step.

## Try it in a browser

1. Allow the sample load and press **Load**. Generation 1 should show 19 Held,
   8 Broke, and 3 Stopped. **Run tests** replays the current recording. Changing
   the sample cap or replaying a run should leave sample spending at $0.84.
2. Select **Broke** at **Change the date** and **Model D**. Look for turn 2 and
   the two fixed checks. Press **Harden** to see two added prompt lines and
   Generation 2 with 27 Held, 2 Broke, and 1 Stopped.
3. Look for Model A, B, C, and E in the declaration. Expand the Generation 1
   failure to revisit the record. Click both **Export** buttons and open the
   downloaded JSON files to verify the model list and the two added lines.
4. In **Compatibility lookup**, check the sample graph with Model A, Model D,
   and Other model for **Yes**, **No**, and **Not tested**. An unknown graph
   address also returns **Not tested**. **View result JSON** shows the local
   response. **Copy** copies the fictional lookup address or selects it for
   manual copying.
5. Try Bench, Carbon, and Imprint at the lower right. At a viewport width of
   390 pixels, check the forms, the six matrix columns, and the action messages.
   The compact matrix uses H, B, and S beside the decision shapes.

Run the pure-function tests from this directory with `node --test`.
