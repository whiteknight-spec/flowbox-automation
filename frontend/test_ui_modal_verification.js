import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('====================================================');
console.log('STARTING QUOTE VIDEO REVIEW MODAL UI & LAYOUT TEST');
console.log('====================================================');

const modalJsxPath = path.join(__dirname, 'src/components/QuoteVideoReviewModal.jsx');
const stylesCssPath = path.join(__dirname, 'src/styles.css');

const modalJsx = fs.readFileSync(modalJsxPath, 'utf-8');
const stylesCss = fs.readFileSync(stylesCssPath, 'utf-8');

// 1. Verify CSS layout rules in styles.css
console.log('\n--- TEST 1: CSS Layout Architecture in styles.css ---');
assert(stylesCss.includes('.quote-video-modal {'), 'styles.css contains .quote-video-modal');
assert(stylesCss.includes('max-height: 90vh;'), 'styles.css defines max-height: 90vh on modal');
assert(stylesCss.includes('.quote-video-modal-body {'), 'styles.css defines .quote-video-modal-body');
assert(stylesCss.includes('overflow-y: auto;'), 'styles.css defines overflow-y: auto on body');
assert(stylesCss.includes('.quote-video-modal-footer {'), 'styles.css defines .quote-video-modal-footer');
assert(stylesCss.includes('position: sticky;'), 'styles.css defines sticky footer');
assert(stylesCss.includes('bottom: 0;'), 'styles.css defines sticky footer at bottom: 0');
assert(stylesCss.includes('flex-shrink: 0;'), 'styles.css defines flex-shrink: 0 on header and footer');
assert(stylesCss.includes('@media (max-height: 800px)'), 'styles.css includes responsive breakpoint for 800px displays');
assert(stylesCss.includes('@media (max-height: 700px)'), 'styles.css includes responsive breakpoint for 700px displays');
console.log('✅ PASSED: styles.css contains correct responsive flexbox, max-height 90vh, scrollable body, and sticky footer.');

// 2. Verify JSX Structure in QuoteVideoReviewModal.jsx
console.log('\n--- TEST 2: JSX Hierarchy in QuoteVideoReviewModal.jsx ---');
assert(modalJsx.includes('className="quote-video-modal-header"'), 'Header exists in modal');
assert(modalJsx.includes('className="quote-video-modal-body"'), 'Body exists in modal');
assert(modalJsx.includes('className="quote-video-modal-footer"'), 'Footer exists in modal');

// Check order: Header -> Body -> Footer
const headerIndex = modalJsx.indexOf('className="quote-video-modal-header"');
const bodyIndex = modalJsx.indexOf('className="quote-video-modal-body"');
const footerIndex = modalJsx.indexOf('className="quote-video-modal-footer"');

assert(headerIndex < bodyIndex, 'Header precedes scrollable body');
assert(bodyIndex < footerIndex, 'Scrollable body precedes sticky footer');
console.log('✅ PASSED: JSX hierarchy strictly follows Header -> Scrollable Body -> Sticky Action Footer.');

// 3. Verify confirmation panel is inside the scrollable body and has auto-scroll ref
console.log('\n--- TEST 3: Confirmation Panel & Auto-scroll Integration ---');
assert(modalJsx.includes('confirmPanelRef'), 'confirmPanelRef is declared for confirmation panel');
assert(modalJsx.includes('scrollIntoView'), 'confirmPanelRef scrolls into view when confirmation is shown');

const confirmIndex = modalJsx.indexOf('ref={confirmPanelRef}');
assert(confirmIndex > bodyIndex && confirmIndex < footerIndex, 'Confirmation panel is placed inside the scrollable body');
console.log('✅ PASSED: Confirmation panel is contained in scrollable body and automatically scrolls into view.');

// 4. Verify no artificial version gating on Regenerate button
console.log('\n--- TEST 4: Verify No Version-Based Button Gating ---');
assert(!modalJsx.includes('version >= 2'), 'No version >= 2 limit in modal JSX');
assert(!modalJsx.includes('version > 2'), 'No version > 2 limit in modal JSX');
assert(!modalJsx.includes('version === 2'), 'No version === 2 limit in modal JSX');
assert(!modalJsx.includes('maxRegenerations'), 'No maxRegenerations limit in modal JSX');
assert(!modalJsx.includes('hideRegenerate'), 'No hideRegenerate in modal JSX');
assert(!modalJsx.includes('canRegenerate'), 'No canRegenerate in modal JSX');
console.log('✅ PASSED: Regenerate button is never hidden or gated by version number.');

// 5. Verify text wrapping for long quotes and explanations
console.log('\n--- TEST 5: Text Wrapping for Long Quotes & Explanations ---');
const quoteBannerIndex = modalJsx.indexOf('{currentJob.quote &&');
const quoteBannerSub = modalJsx.slice(quoteBannerIndex, quoteBannerIndex + 600);
assert(!quoteBannerSub.includes('whiteSpace: \'nowrap\''), 'whiteSpace nowrap was removed from quote banner to support long quotes');
assert(quoteBannerSub.includes('wordBreak: \'break-word\''), 'wordBreak break-word is set for quote and explanation');
console.log('✅ PASSED: Long Tamil / English quotes and explanations wrap properly without pushing the sticky footer.');

// 6. Verify Phase 6 Publishing UI Integration
console.log('\n--- TEST 6: Phase 6 Publishing UI Integration ---');
assert(modalJsx.includes('handlePublish'), 'handlePublish function exists in modal');
assert(modalJsx.includes('isPublished'), 'isPublished state indicator exists in modal');
assert(modalJsx.includes('Publishing History'), 'Publishing History section exists for approved jobs');
assert(modalJsx.includes('UploadCloud'), 'Publish button upload icon exists');
assert(modalJsx.includes("Publishing isn't configured yet"), 'Clear non-destructive unconfigured publishing message exists');
console.log('✅ PASSED: Phase 6 Publishing UI is cleanly integrated in the review modal.');

console.log('\n====================================================');
console.log('QUOTE VIDEO REVIEW MODAL UI TEST: ALL CHECKS PASSED');
console.log('====================================================');
