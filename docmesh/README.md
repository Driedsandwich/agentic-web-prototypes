# Docmesh

Docmesh is an interactive prototype of an answer with sources from three documentation networks. It uses fictional `.example` addresses and short sample summaries. Ask assembles a fixed answer in this page. The prototype sends nothing out, runs no AI model, and costs nothing. The call path and its Peer Preflight results are samples.

## Try it locally

Serve this directory with any static HTTP server. For example, run `python3 -m http.server --bind 127.0.0.1 8000` here and open `http://127.0.0.1:8000/`. No build step or dependencies are required.

1. Check that the starting instructions and the open **Words used here** section are visible. Open the question picker and choose one of the three questions.
2. Press **Ask**. Check for three sentences, each with its own source, section, and license. Open and close each source badge and check its summary and feedback. The square AGW, circle MDN, and diamond MCP identify the three sources.
3. Follow **Call path** from Question to spec-docs, mcp-spec-docs, and web-platform-docs. Check that the returned sections, addresses, and preflight results are labeled as samples.
4. Press **Copy template** and paste into a local text editor. Check for four lines of JSON. If the browser blocks clipboard access, the page selects the template for manual copying.
5. Change the palette at the bottom right. Try Shelf Marks, Index Leaves, and Proof Copy. At 390 px, check that the question and the URL wrap, the call path stacks, and the page has no horizontal scroll. Try the controls with a keyboard.

Run the sample-flow tests with `node --test` from this directory.
