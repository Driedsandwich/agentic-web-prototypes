# Pliant

Pliant is a sample workshop sign-up that changes its layout when you pause. The
workshop, prefilled answers, and form-coach address are fictional. The demo
runs on fixed rules in the page. It sends no data, runs no AI model, and costs
nothing.

Serve this folder as static files and open `index.html` through that server.
For a local preview, run `python3 -m http.server --bind 127.0.0.1 8000` in this
folder and open `http://127.0.0.1:8000/`. No build or packages are needed.

## Try it by hand

1. Open **About you** or **Course choice** and edit a sample answer. With
   **Adaptive help** on, focus **Bringing a companion?** for eight seconds, or
   select **Try the pause demo** for the same changes immediately.
2. Check that the example appears, Payment folds, and the two required
   companion fields move directly below the question. Choose **No** and then
   **Yes** to check that the fields reappear with their values.
3. In each **Why this changed** note, try **Show original**, **Show adapted**,
   **Why now?**, and **Undo**. Run the pause demo again, then switch Adaptive
   help off to restore the original layout. Check that **Data shared** shows the pause and field IDs alongside
   **0 entered values shared**.
4. Select **Review all inputs**, check the values, and select **Submit**.
   It shows **Sample: nothing is submitted**. Edit an answer to require a
   fresh review. Clear a required answer and check that Submit is disabled.
5. Repeat at 390 px and with the keyboard. Check the palette picker in the
   bottom-right corner for Basting Thread, Pencil Guide, and Proof Sheet.

Run `node --test` in this folder to check the form rules. Run
`node --test --test-isolation=none` to see each test listed individually.
