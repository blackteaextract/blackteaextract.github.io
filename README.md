# bl-xt.xyz

My personal site. Plain Markdown, built by Hugo, deployed by GitHub Actions.

## Write a post

1. Create `content/read/<name>.md`:

   ```markdown
   ---
   title: my_new_post
   date: 2026-11-25
   ---

   Text in Markdown.
   ```

   (or run `hugo new read/<name>.md`, which starts as a draft: remove `draft: true` to publish)

2. `git add . && git commit -m "new post" && git push`

The site updates about a minute after the push. Images:
put them in `static/images/` and link them as `/images/file.jpg`.

## Preview locally (optional)

```sh
hugo server
```

## Where things are

- `content/` — the posts (`read/`), the about page and the home intro (`_index.md`)
- `hugo.toml` — title, tagline, links on the home page
- `layouts/` — the HTML (four small files)
- `assets/style.css` — all of the styling
