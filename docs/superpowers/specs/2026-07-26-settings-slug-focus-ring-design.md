# Settings slug focus ring design

The Settings shop URL remains a compound field: `framelink.app/` is a fixed, non-editable prefix and only the slug after `/` is editable.

When the slug input receives keyboard or pointer focus, a single accent border and focus ring must surround the complete compound field. The nested input must suppress its global `focus-visible` outline so no second rectangle appears around only the editable portion.

Verification covers wrapper focus classes, nested outline suppression, unchanged slug sanitization, and a browser focus screenshot.

