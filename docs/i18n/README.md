# Salvaged Slovenian string catalogue

`sl_default.json` is a byte-for-byte copy of `scripts/era5/locales/sl_default.json`
as it existed before the ERA5 sidecar service was deleted. It is **reference
material, not a live asset** — nothing in the site loads it, and `docs/` is neither
an Eleventy input directory nor a passthrough copy, so it is never bundled.

**Provenance.** Its only consumer was the sidecar Flask app, which read it at
`mk_api.py:59` and exposed two of its keys (`hero.explain_reg`,
`hero.explain_cal`) through `/api/live/meta`. The sidecar was deleted along with
the rest of that stack; the page it once served is fed entirely from the
`climate-si` datasette. Recoverable from git history if the original path is ever
needed.

**Why it was kept.** 475 lines of already-reviewed Slovenian UI copy in catalogue
form. The planned string-extraction work seeds its `sl.json` from this file rather
than re-translating the strings that are currently hard-coded in
`code/ali-je-vroce-era5/`.

Caveats for whoever picks it up:

- It describes an **older** version of the page. Keys will not map one-to-one onto
  the current components; treat overlap as a starting point, not a contract.
- Some entries reference the ARSO/Vremenar data path, which no longer exists.
- The wording is editorial. Anything reused should be checked by a human who owns
  the site's copy, not adopted verbatim because it was already in the repo.
