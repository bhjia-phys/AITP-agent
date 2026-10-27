---
description: "Provisional study drafts, real answer capture and source-grounded task preparation."
kind: "package-reference"
---

# AITP study notes

English | [中文](README.zh.md)

## Summary

Browse, write, edit and export local provisional notes. Explicitly capture a real completed assistant answer with its original Session, actor, provider/model and recorded source attribution. Prepared comparisons, reviews, close-reading outlines, study cards and concept maps remain editable questions in the ordinary Harness conversation flow.

## Table of Contents

- [Configuration and behavior](#configuration-and-behavior)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

## Configuration and behavior

This independent browser plugin mounts only `researchStudy`; it does not mount another source service or start a second chat runtime. The Host study plugin owns operational storage and the optional read-only source bridge. Missing service/storage stays visible. No fixture is selected automatically.

The global Study notes entry uses the existing main panel and sidebar footprint. Source collection task shortcuts contribute to the shared Materials task slot. They prepare question text without model traffic; the existing composer submits the actual selected references. “Write a reading note” records selected references as human-linked citations. It does not claim the model read them.

The completed-answer action obtains the currently displayed durable assistant sequence and submits only Session and event identity. The Host restores the answer text and source attribution; the browser cannot manufacture a model-captured answer by uploading text. Editing a captured answer retains that origin. Chosen sources, recorded context and recorded source reads remain different citation bases. Every artifact remains provisional and saving it does not write `research.md` or create a knowledge atom.

Saved note source references are supplied by the Host. Opening one goes through the shared material reader, where it can be explicitly selected for a new question. Markdown export includes the saved note and its source attribution. Removing a draft retains original sources and Session events.

Removing a saved artifact clears only an editor draft for that artifact. An unrelated unfinished note remains available through “Continue draft”.

After a confirmed save, capture or removal, the next list view starts at its first page while retaining the selected kind filter. The previous page cursor belongs to the earlier list revision and cannot be reused after that mutation.

Mutations use one stable operation identity. Unknown acknowledgements retain the original request and lock draft changes until the explicit check confirms that operation. Navigation, local editing and merely opening a source send no model request.

A bounded same-tab journal preserves pending save, capture and removal requests across a page reload. Restoration marks them uncertain, retains the original operation identity and does not replay them. Acknowledgement clears the journal. Failed storage and unreadable recovery records remain visible and do not replace the Host's saved artifacts.

## Dev Note

Client declarations and module contributions remain reversible. Package tests cover the shared transport, source locations, explicit scope and failure recovery; the independent study surface also checks genuine answer coordinates and source-grounded task preparation. Real provider and browser validation are tracked by the implementation plan.

## Model Experience

Indirectly, through normal Harness questions and the optional Host source bridge; saving a draft or preparing a task does not submit model input.

#### KV Cache effect

The Host owns source rereads, model delivery and request assembly. This plugin owns no model request prefix.

## Known Limitations and Deferred Work

- Unsaved editor state lives for the loaded client. Pending operations survive same-tab reload when session storage is available; closing the tab may discard those recovery records. Saved artifacts and acknowledged operations live in Host storage.
- Another client's writes require an explicit refresh. The API does not currently publish artifact change events.
- Task shortcuts do not generate audio/video, rendered mind maps, OCR, or unverified automatic knowledge promotion.
- Capturing an answer requires its real completed Session event. Interrupted prefixes and absent identities are not eligible.
