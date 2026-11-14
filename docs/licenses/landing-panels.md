# Landing page panel photographs

Four photographs were downloaded from individual Unsplash photo pages on 2026-11-14 for
the full-viewport panels on `/`. Each source page's JSON-LD declared the free Unsplash
License; the files were taken from `images.unsplash.com`, and **no Unsplash+ images are
included** — those carry a different licence and were filtered out of the candidates.

License: https://unsplash.com/license

The license permits downloading, modifying and using these photographs for commercial
projects. They are used as landing-page decoration, not resold as stock photos or offered
as a competing image library. Attribution is optional under the license; photographers,
source pages, download URLs and retrieval details are preserved in
`public/images/landing/credits.json`.

| Panel | Photographer | Subject |
|---|---|---|
| `panel-sell` | Subhra Jyoti Paul | A modern desk setup with two screens |
| `panel-files` | Denise Jans | A MacBook Pro turned on, on a desk |
| `panel-course` | Vitaly Gariev | A woman filming herself with a camera in a living room |
| `panel-pay` | Markus Winkler | A smartphone displaying a QR code |
| `hero` | Vitaly Gariev | A man wearing glasses types on a laptop at a desk |
| `cat-ebook` | Rishikesh Sreehari | A tablet beside a book on a desk |
| `cat-template` | Kari Shea | A tablet on a wooden table |
| `cat-key` | Matúš Gocman | A video game controller and box on a desk |
| `proof` | Vitaly Gariev | A person smiles while working on a laptop |

One further candidate — a desk photograph by Olivie Strauss — was **rejected**: its
page reported `https://unsplash.com/plus/license` and served from
`plus.unsplash.com`, so it is Unsplash+ rather than the free licence. Every file
listed above was checked the same way before download.

Panel files are WebP at 1920 × 1080 with a 960 × 540 companion served through
`srcSet`/`sizes`; the hero, grid and proof images are single files sized to their slot.
Total weight is roughly 1.9 MB across the set.

**A supplied mock-up was the visual reference for layout only.** No third-party
photograph, wordmark, logo, icon or copy was used. Rights for every image here were
verified against the originating Unsplash page, not inferred from search availability.
