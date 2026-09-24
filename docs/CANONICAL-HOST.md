# The canonical host is wrong — decision needed

**Status: open. Nothing in the repo has been changed to work around it.**

This is currently the single biggest thing holding the site back in search. It
is a one-command fix once the owner picks a host.

## What is wrong

The site is live and healthy at:

```
https://ng-psi.vercel.app/          -> 200 OK
```

But every page tells Google its real address is somewhere else:

```html
<link rel="canonical" href="https://treasureacademyageva.vercel.app/index.html">
```

And that address does not exist:

```
$ curl -sI https://treasureacademyageva.vercel.app/
HTTP/2 404
x-vercel-error: DEPLOYMENT_NOT_FOUND
```

`robots.txt` and all 31 `sitemap.xml` URLs point at the dead host too.

## Why it matters

A canonical tag is an instruction, not a hint: *"do not index this page, index
that one instead."* Every page on the live site is currently pointing crawlers
at a URL that returns 404. The likely outcome is that nothing ranks — the pages
that work are disavowing themselves, and the address they nominate is empty.

The SEO work itself is sound: unique descriptions, Open Graph, Twitter cards,
`School` structured data, a clean sitemap. It is all aimed at the wrong
hostname.

## The fix — pick one

**Option A — point the repo at the working URL.** Fastest, no external access
needed:

```bash
python3 tools/set-site-host.py https://ng-psi.vercel.app
bash tools/run-all-tests.sh
```

**Option B — make the nice URL work.** Keep every URL as it is and add
`treasureacademyageva.vercel.app` as a domain/alias on the Vercel project
(Project → Settings → Domains). Nothing in the repo changes. Preferable if the
owner wants that name, since it reads better than `ng-psi`.

**Option C — wait for a real domain.** A custom domain is on the backlog. If it
is close, point everything at that once and avoid moving twice — every move
costs some ranking equity.

## Tool

`tools/set-site-host.py` rewrites the host everywhere in one pass: the `SITE`
constant in `seo-build.py`, all generated tags across the HTML, `robots.txt`,
`sitemap.xml`, `site.webmanifest` and `docs/`. It re-runs the SEO build itself
and prints a before/after count. Run it, then run the tests.

```bash
python3 tools/set-site-host.py --check                     # report only
python3 tools/set-site-host.py https://treasureacademy.ng  # switch
```

## Note for whoever does this

If the site has already been indexed under the dead host, add a redirect from
the old host to the new one rather than dropping it, so any accumulated links
still resolve. On Vercel that is a `redirects` entry in `vercel.json` or a
domain-level redirect in the dashboard.
