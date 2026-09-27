/**
 * The page engine: CSS multi-column pagination with a translateX per page, swipe and tap
 * zones, keyboard, and relayout that keeps the reader on the same text. Plain ES2020, no
 * dependencies, no framework: imported by the website's reader (Vite), by the kit reader's
 * iframe/WebView document (as injected source text), and by the harness.
 *
 * `container` is the clipping element; its first element child is the column element
 * that receives `column-width` and the transform (exactly the DOM shape the website's
 * ReaderPage uses).
 */
export function createPageEngine(container, options = {}) {
  const opts = {
    onPage: () => {},
    onTap: () => {},
    onEdge: () => {},
    tapZones: true,
    swipe: true,
    keyboard: true,
    resizeDebounceMs: 300,
    ...options,
  };

  const column = container.firstElementChild;
  if (!column) throw new Error('createPageEngine: container has no column element');

  let width = 0;
  let page = 0;
  let count = 1;
  let destroyed = false;

  function applyColumnStyles() {
    width = container.clientWidth;
    column.style.columnWidth = width > 0 ? `${width}px` : '100%';
    column.style.columnGap = '0px';
    column.style.columnFill = 'auto';
    column.style.height = '100%';
  }

  function applyTransform() {
    column.style.transform = width > 0 ? `translateX(-${page * width}px)` : 'none';
  }

  function measure() {
    const prev = column.style.transform;
    column.style.transform = 'none';
    const scrollW = column.scrollWidth;
    column.style.transform = prev;
    count = Math.max(1, Math.ceil(scrollW / Math.max(width, 1)));
    if (page > count - 1) page = count - 1;
  }

  // The anchor is captured after every change, under the layout the reader is looking at,
  // so a later relayout (font, theme, resize) can find the same text even though the
  // style change has already invalidated the old layout by the time it runs.
  // Consecutive relayouts (a font stepper, a resize) keep the same anchor, otherwise each
  // step would re-anchor on the new top line and the position would creep backwards.
  let lastAnchor = null;
  function emit(fromRelayout = false) {
    opts.onPage(page, count, offsetPct());
    if (!fromRelayout || !lastAnchor || !lastAnchor.node.isConnected) lastAnchor = anchorAt();
  }

  function offsetPct() {
    return count <= 1 ? 0 : Math.round((page / (count - 1)) * 100);
  }

  function layout() {
    if (destroyed) return;
    applyColumnStyles();
    // Two frames: the column width must be painted before scrollWidth reflects the real pagination.
    measure();
    applyTransform();
    emit();
  }

  function goTo(n) {
    const target = Math.max(0, Math.min(count - 1, Math.floor(n)));
    if (target === page) return false;
    page = target;
    applyTransform();
    emit();
    return true;
  }

  function next() {
    const moved = goTo(page + 1);
    if (!moved) opts.onEdge('next');
    return moved;
  }

  function prev() {
    const moved = goTo(page - 1);
    if (!moved) opts.onEdge('prev');
    return moved;
  }

  function goToPct(pct) {
    const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
    const target = count <= 1 ? 0 : Math.round((clamped / 100) * (count - 1));
    page = target;
    applyTransform();
    emit();
  }

  // --- anchoring: the first visible text position survives a relayout exactly -----------
  function anchorAt() {
    const rect = container.getBoundingClientRect();
    const probe = (x, y) => {
      if (document.caretRangeFromPoint) {
        const r = document.caretRangeFromPoint(x, y);
        return r ? { node: r.startContainer, offset: r.startOffset } : null;
      }
      if (document.caretPositionFromPoint) {
        const p = document.caretPositionFromPoint(x, y);
        return p ? { node: p.offsetNode, offset: p.offset } : null;
      }
      return null;
    };
    // A point in padding resolves to the nearest caret, which can sit on another page;
    // only an anchor that lays out on the current page is trusted.
    for (const dy of [6, 30, 60, 110, 180, 260, 360]) {
      for (const dx of [44, 6]) {
        const a = probe(rect.left + dx, rect.top + dy);
        if (a && a.node && a.node.nodeType === 3 && column.contains(a.node) && pageOf(a) === page) return a;
      }
    }
    return null;
  }

  function pageOf(anchor) {
    if (!anchor.node.isConnected) return null;
    const len = anchor.node.length || 0;
    const range = document.createRange();
    try {
      range.setStart(anchor.node, Math.min(anchor.offset, len));
      range.setEnd(anchor.node, Math.min(anchor.offset + 1, len));
    } catch (e) { return null; }
    const prev = column.style.transform;
    column.style.transform = 'none';
    const rects = range.getClientRects();
    const r = rects.length ? rects[0] : range.getBoundingClientRect();
    const x = r.left - container.getBoundingClientRect().left;
    column.style.transform = prev;
    if (!(width > 0) || !Number.isFinite(x)) return null;
    return Math.max(0, Math.min(count - 1, Math.floor((x + 1) / width)));
  }

  function relayoutKeepingPosition() {
    const anchor = lastAnchor || anchorAt();
    const pct = offsetPct();
    applyColumnStyles();
    measure();
    const target = anchor ? pageOf(anchor) : null;
    if (target === null) { goToPct(pct); return; }
    page = target;
    applyTransform();
    emit(true);
  }

  // --- gestures -------------------------------------------------------------------------
  let touch = null;
  function onTouchStart(e) {
    if (!e.touches || e.touches.length === 0) return;
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }
  function onTouchEnd(e) {
    if (!touch || !e.changedTouches || e.changedTouches.length === 0) return;
    const dx = e.changedTouches[0].clientX - touch.x;
    const dy = e.changedTouches[0].clientY - touch.y;
    const startX = touch.x;
    touch = null;
    if (opts.swipe && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next(); else prev();
      return;
    }
    if (opts.tapZones && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      tapAt(startX);
    }
  }
  let mouse = null;
  function onMouseDown(e) { mouse = { x: e.clientX, y: e.clientY }; }
  function onMouseUp(e) {
    if (!mouse) return;
    const dx = e.clientX - mouse.x;
    const dy = e.clientY - mouse.y;
    const x = mouse.x;
    mouse = null;
    if (opts.tapZones && Math.abs(dx) < 10 && Math.abs(dy) < 10) tapAt(x);
  }
  function tapAt(clientX) {
    const rect = container.getBoundingClientRect();
    const rel = (clientX - rect.left) / Math.max(rect.width, 1);
    const zone = rel < 1 / 3 ? 'left' : rel > 2 / 3 ? 'right' : 'center';
    opts.onTap(zone);
    if (zone === 'left') prev();
    if (zone === 'right') next();
  }
  function onKey(e) {
    if (!opts.keyboard) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  }

  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchend', onTouchEnd, { passive: true });
  container.addEventListener('mousedown', onMouseDown);
  container.addEventListener('mouseup', onMouseUp);
  window.addEventListener('keydown', onKey);

  let resizeTimer = null;
  const observer = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { if (!destroyed && container.clientWidth !== width) relayoutKeepingPosition(); }, opts.resizeDebounceMs);
      })
    : null;
  if (observer) observer.observe(container);

  function destroy() {
    destroyed = true;
    container.removeEventListener('touchstart', onTouchStart);
    container.removeEventListener('touchend', onTouchEnd);
    container.removeEventListener('mousedown', onMouseDown);
    container.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('keydown', onKey);
    clearTimeout(resizeTimer);
    if (observer) observer.disconnect();
  }

  return {
    layout,
    next,
    prev,
    goTo,
    goToPct,
    relayoutKeepingPosition,
    offsetPct,
    destroy,
    get page() { return page; },
    get count() { return count; },
    get width() { return width; },
  };
}
