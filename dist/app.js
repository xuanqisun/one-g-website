(() => {
  const hero = document.querySelector('.hero');
  if (hero) {
    const slides = [...hero.querySelectorAll('[data-slide]')];
    const tabs = [...hero.querySelectorAll('[data-slide-to]')];
    let active = 0;
    function showSlide(next) {
      active = (next + slides.length) % slides.length;
      slides.forEach((slide, i) => { slide.hidden = i !== active; });
      tabs.forEach((tab, i) => tab.setAttribute('aria-pressed', String(i === active)));
      hero.classList.toggle('is-dark', active === 1);
      document.getElementById('slide-current').textContent = String(active + 1).padStart(2, '0');
    }
    tabs.forEach((tab, i) => tab.addEventListener('click', () => showSlide(i)));
    const carousel = hero.closest('.hero-wrap');
    carousel.querySelectorAll('[data-slide-prev]').forEach(button => button.addEventListener('click', () => showSlide(active - 1)));
    carousel.querySelectorAll('[data-slide-next]').forEach(button => button.addEventListener('click', () => showSlide(active + 1)));
    hero.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        showSlide(active + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
    let touchStart = null;
    hero.addEventListener('touchstart', event => {
      const touch = event.changedTouches[0]; touchStart = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });
    hero.addEventListener('touchend', event => {
      if (!touchStart) return;
      const touch = event.changedTouches[0]; const dx = touch.clientX - touchStart.x; const dy = touch.clientY - touchStart.y;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) showSlide(active + (dx < 0 ? 1 : -1));
      touchStart = null;
    }, { passive: true });
  }
  const dialog = document.querySelector('.video-dialog');
  if (dialog) {
    const video = dialog.querySelector('video');
    document.querySelectorAll('[data-play-video]').forEach(button => button.addEventListener('click', () => {
      dialog.showModal(); video.play().catch(() => {});
    }));
    dialog.querySelector('[data-close-video]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => video.pause());
    dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  }
  const inquiry = document.getElementById('inquiry-form');
  if (inquiry) {
    const directions = { integration: '设备与接口适配', arm: '机械臂定制', board: '板卡与智能硬件', other: '其他需求' };
    const selectedDirection = new URLSearchParams(location.search).get('direction');
    if (Object.hasOwn(directions, selectedDirection)) inquiry.elements.direction.value = selectedDirection;
    const summary = document.getElementById('request-summary');
    const copyStatus = document.getElementById('copy-status');
    function prepareRequest(input) {
      if (!input || !Object.hasOwn(directions, input.direction)) throw new Error('请选择有效的项目方向。');
      if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100000) throw new Error('数量应为 1 至 100000 的整数。');
      if (typeof input.scenario !== 'string' || !input.scenario.trim() || input.scenario.length > 2000) throw new Error('请填写 1 至 2000 字的应用需求。');
      for (const [name, limit] of [['platform', 160], ['timeline', 240]]) {
        if (input[name] !== undefined && (typeof input[name] !== 'string' || input[name].length > limit)) throw new Error('设备或时间要求长度超出限制。');
      }
      for (const name of ['direction', 'quantity', 'platform', 'scenario', 'timeline']) inquiry.elements[name].value = input[name] ?? '';
      inquiry.elements.scenario.setCustomValidity('');
      summary.value = ['ONE-G 项目需求', '', '项目方向：' + directions[input.direction], '预计数量：' + input.quantity + ' 台 / 套', '已有设备或平台：' + (input.platform?.trim() || '待沟通'), '', '应用场景与主要需求：', input.scenario.trim(), '', '期望时间或其他要求：' + (input.timeline?.trim() || '待沟通'), '', '此摘要由本地页面生成，尚未提交至 ONE-G。'].join('\n');
      document.getElementById('summary-result').hidden = false;
      copyStatus.textContent = '未发送至 ONE-G';
      return { status: 'prepared_locally', submitted: false, summary: summary.value };
    }
    inquiry.addEventListener('submit', event => {
      event.preventDefault();
      const fields = new FormData(inquiry);
      const scenario = String(fields.get('scenario') || '').trim();
      if (!scenario) { inquiry.elements.scenario.setCustomValidity('请填写应用场景与主要需求。'); inquiry.elements.scenario.reportValidity(); return; }
      prepareRequest({ direction: fields.get('direction'), quantity: Number(fields.get('quantity')), platform: fields.get('platform'), scenario, timeline: fields.get('timeline') });
      summary.focus();
    });
    inquiry.elements.scenario.addEventListener('input', () => inquiry.elements.scenario.setCustomValidity(''));
    document.getElementById('copy-summary').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(summary.value); copyStatus.textContent = '已复制；尚未发送至 ONE-G'; }
      catch { summary.focus(); summary.select(); copyStatus.textContent = '请手动复制已选中的摘要；尚未发送'; }
    });
    if (document.modelContext?.registerTool) {
      const lifecycle = new AbortController();
      window.addEventListener('pagehide', event => { if (!event.persisted) lifecycle.abort(); }, { once: true });
      try {
        Promise.resolve(document.modelContext.registerTool({
          name: 'prepare_custom_request', title: '整理 ONE-G 定制需求',
          description: '填写定制需求并在页面生成摘要。仅在当前页面整理，不上传、不发送、不保存，也不操作剪贴板。',
          inputSchema: { type: 'object', properties: { direction: { type: 'string', enum: Object.keys(directions) }, quantity: { type: 'integer', minimum: 1, maximum: 100000 }, platform: { type: 'string', maxLength: 160 }, scenario: { type: 'string', minLength: 1, maxLength: 2000 }, timeline: { type: 'string', maxLength: 240 } }, required: ['direction', 'quantity', 'scenario'], additionalProperties: false },
          annotations: { readOnlyHint: false, untrustedContentHint: true }, execute: prepareRequest,
        }, { signal: lifecycle.signal })).catch(() => {});
      } catch { /* The visible form works without browser tool support. */ }
    }
  }
})();
