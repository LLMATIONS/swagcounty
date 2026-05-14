# swagcounty

Workshop index page for the **Swag County** delight lane of [LLMATIONS](https://github.com/LLMATIONS) — a small side workshop shipping named branded artifacts.

Lives at <https://swagcounty.com>.

## What's in here

- `index.html` — the workshop landing page (Neal.fun-flavored, single-file, no JS)
- `assets/` — shared brand assets (currently empty)
- That's the whole repo. Each delight-lane *project* (e.g. [shuffleify](https://github.com/LLMATIONS/shuffleify)) gets its own repo with its own deploy story.

## Local preview

Any static file server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy

Production is self-hosted behind a Cloudflare Tunnel — HTTPS terminates at the CF edge and is tunnelled back to a static-file checkout of `main`. After a PR merges, deploy is a `git pull` on that checkout.

Operational specifics (host, path, automation hooks) live in the private LLMATIONS [internal-docs](https://github.com/LLMATIONS/internal-docs) repo.

## Workflow

Per the [LLMATIONS partnership rules](https://github.com/LLMATIONS/internal-docs):

- **Never push directly to `main`.** Branch per task, PR to `main`, self-merge after the other partner has had a chance to comment (or immediately if trivial).
- Suggested branch names: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `chore/<topic>`.
- Both partners are org owners with push access.

## License

[AGPL-3.0](LICENSE). Workshop-wide default — defends against SaaS-clone re-skins of public artifacts.
