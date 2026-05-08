# Client-Side Image Resize — Design Spec

**Status:** Spec finalized May 8, 2026 — ready to build
**Owner:** Leonardo Magosteiro
**Build target:** This session

## 1. Purpose

Reduce customer-uploaded receipt photos to a size the AI extraction pipeline can process, before they leave the customer's device. Eliminate the failure mode where photos exceed the 5MB base64 threshold and never reach the AI.

## 2. Scope

**In scope:** Resize image dimensions and re-encode to reduce file size before upload. HEIC-to-JPEG conversion (iPhone format).

**Out of scope:** Cropping, rotation, orientation correction, edge detection, contrast/brightness enhancement, or any other image manipulation. If the photo is bad in any way other than too big, we do not touch it.

## 3. Architecture decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Where resize happens | Client-side (browser), immediately after file selection, before preview | Customers are on mobile data in shopping malls; uploading 15MB files over slow connections is the worst UX. Resize-then-preview means the file is small by the time they tap upload. |
| Library | `browser-image-compression` (npm) | Battle-tested, handles HEIC via internal canvas conversion, simple API, ~30KB gzipped, used by thousands of production apps. Hand-rolling Canvas API is unnecessary risk. |
| Target max dimension | 1920px on the longest edge | Receipts are long and narrow. 1920px preserves text legibility for OCR while cutting modern iPhone photos (often 4032x3024) by ~75% in pixel count. |
| Target max file size | 4MB after compression | Stays comfortably below the 5MB base64 threshold (base64 inflates ~33%, so 4MB raw ~= 5.3MB base64 — but the threshold is on the encoded string, and the API actually accepts up to ~7MB encoded, so 4MB raw is safe with margin). |
| Output format | JPEG, quality 0.85 | Receipts are photographic; JPEG compresses them well. Quality 0.85 is the sweet spot — visually indistinguishable from original at typical phone screen sizes, file size 60-70% smaller than quality 1.0. |
| HEIC handling | `browser-image-compression` converts to JPEG automatically via canvas | iPhone default since iOS 11. Browsers can't always render HEIC. The library handles this transparently — input HEIC, output JPEG. |
| Skip resize for small files | Yes — if input is already under 2MB, pass through unchanged | No reason to recompress an already-small file; would only degrade quality. |
| Failure behavior | Block upload, show error message in Portuguese asking user to try a different photo | Per Leonardo's decision: better to ask the customer to try again than to send a file we know the AI can't process. |
| Customer feedback during resize | Show a loading state with text "Otimizando foto..." (typically 1-3 seconds on modern phones) | Resize on a 15MB iPhone photo takes 1-3 seconds; without feedback the UI feels frozen. |

## 4. Implementation requirements

### File: `lib/resize-image.ts` (new)

Export a single async function:

```typescript
export async function resizeReceiptImage(file: File): Promise<File>
```

**Behavior:**
1. If `file.size < 2 * 1024 * 1024` (2MB), return the file unchanged.
2. Otherwise, call `browser-image-compression` with options:
   - `maxSizeMB: 4`
   - `maxWidthOrHeight: 1920`
   - `useWebWorker: true` (don't block the main thread)
   - `fileType: 'image/jpeg'`
   - `initialQuality: 0.85`
3. Return the resulting File object. The library preserves the original filename but updates size and type.
4. If the library throws, re-throw with a Portuguese error message: `'Nao foi possivel otimizar a foto. Tente uma foto diferente.'` so the upload page can display it.

### File: `app/enviar-recibo/page.tsx` (modify)

In the file-selection handler (the existing `onChange` for the file input):

1. After the user selects a file, before showing the preview, call `resizeReceiptImage(file)`.
2. Show a loading state during the resize: a small spinner or text "Otimizando foto..." replacing the preview area.
3. If resize succeeds: replace the file in component state with the resized file. Show preview of the resized image.
4. If resize throws: display the error message returned from the function in the existing error UI for this form. Do not show a preview. Do not allow upload until the user picks a different file.

The existing upload submission logic does not change — it still POSTs whatever file is in component state to `/api/upload-recibo`. The resize is invisible to the upload code.

### File: `app/enviar-recibo/page.tsx` (photo guidance update)

In the existing photo guidance section (added in commit `319515e`), add one new bullet after the existing checklist:

> Nao se preocupe com o tamanho da foto — vamos otimizar automaticamente.

(Translation: "Don't worry about photo size — we'll optimize automatically.")

### File: `package.json`

Add dependency:
```
"browser-image-compression": "^2.0.2"
```

## 5. Failure modes and how they're handled

| Failure | Detection | Response |
|---|---|---|
| User selects a non-image file | `file.type` doesn't start with `image/` | (Already handled by existing `<input accept="image/*">`) |
| HEIC file from iPhone | Library handles internally | Transparent conversion to JPEG |
| File is corrupted / unreadable | Library throws | Show error in Portuguese, block upload, ask for different photo |
| Browser doesn't support required APIs (very old phones) | Library throws on instantiation | Show error in Portuguese, block upload |
| Resize succeeds but resulting file is still over 4MB | Library is configured to honor maxSizeMB but in extreme cases (very high-detail photos at high quality) it may not converge | Re-attempt with quality 0.7; if still over 4MB, block with error |
| User selects multiple files | (Existing input is single-file) | N/A |

## 6. Testing strategy

Before commit, manually test all of:

1. **Modern iPhone photo (HEIC, ~10-15MB):** select -> see "Otimizando..." -> preview appears -> file is now under 4MB JPEG. Verify by inspecting the File object in DevTools.
2. **Modern Android photo (JPEG, ~5-8MB):** same expected flow, smaller starting size.
3. **Already-small image (~500KB):** select -> preview appears immediately, no resize loading state, file unchanged.
4. **Corrupted image file:** rename a `.txt` to `.jpg` and select it -> error message in Portuguese, upload blocked.
5. **End-to-end:** after a successful resize, complete the upload and verify the receipt appears in the database with `status = 'uploaded'` and the AI processing pipeline runs without the size-limit error.

## 7. Out of scope (explicit non-goals)

- Server-side resize as a safety net (single layer is sufficient for this scale)
- Image quality enhancement (sharpening, contrast, denoise)
- Multi-file upload
- Camera capture optimization (we use the OS file picker which uses the OS camera)
- Progress bar (resize is fast enough that a simple loading text is sufficient)

## 8. Build order

1. Install `browser-image-compression` package.
2. Create `lib/resize-image.ts`.
3. Modify `app/enviar-recibo/page.tsx` to call the resize function and handle loading/error states.
4. Update the photo guidance bullet.
5. Run dev server, test all 5 cases from section 6.
6. Commit each logical change separately:
   - `feat(upload): add browser-image-compression dependency and resize helper`
   - `feat(upload): integrate client-side resize into receipt upload flow`
   - `feat(upload): mention auto-resize in photo guidance section`
7. Push.

## 9. Update protocol

After implementation is complete and tested:
- Update `docs/PROJECT_HANDOFF.md` section 20 (Session log) with what was built
- Update section 8 to remove the oversized-photo issue from "broken or fragile" and add a brief note in section 7 ("What's working in production")
- Update section 9 (Decisions) if any decisions in this spec changed during implementation
- Commit the handoff update separately
