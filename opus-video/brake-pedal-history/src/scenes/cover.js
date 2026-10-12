/**
 * 封面：支架正在断开的一瞬（碎片悬停、断口红热）+ 片名排版。
 * 渲染：render.py "index.html?cover=1" out/cover.png --still 0
 */
(function () {
  const { W, H, maskText, text, FONT_MONO, FONT_HEAD, FONT_BODY } = L;
  window.COVER_SCENE = {
    render(ctx, T) {
      const { RED } = SCENES[1].cover(ctx, T);
      const g = ctx.createLinearGradient(0, 0, 1100, 0);
      g.addColorStop(0, 'rgba(5,6,7,0.92)'); g.addColorStop(0.7, 'rgba(5,6,7,0.55)'); g.addColorStop(1, 'rgba(5,6,7,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1100, H);
      const x = 130;
      text(ctx, '一块踏板，', x, 360, { size: 150, font: FONT_HEAD, color: '#fff', spacing: 4 });
      text(ctx, '一百四十年', x, 530, { size: 150, font: FONT_HEAD, color: '#fff', spacing: 4 });
      ctx.fillStyle = RED; ctx.fillRect(x + 6, 584, 420, 6);
      text(ctx, '1612', x, 742, { size: 150, font: FONT_MONO, color: RED });
      text(ctx, 'N', x + 372, 742, { size: 72, font: FONT_MONO, color: RED });
      text(ctx, '一脚刹车，支架断了', x + 6, 806, { size: 40, font: FONT_HEAD, color: '#fff' });
      text(ctx, '从 1886 年的手拉杆，讲到 2026 年的线控刹车', x + 6, 860, { size: 28, font: FONT_BODY, color: 'rgba(201,206,214,0.85)' });
      text(ctx, '1886 — 2026', x + 6, H - 96, { size: 30, font: FONT_MONO, color: 'rgba(201,206,214,0.7)', spacing: 2 });
      text(ctx, 'Opus5.5/Astra & Awei', W - 120, H - 96, { size: 32, font: FONT_HEAD, color: '#fff', align: 'right', spacing: 1 });
    },
  };
})();
