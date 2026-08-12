/* RCJ Training 3.0 — 自适应职业能力训练 (MVP)
   原则：标准全由用户自定义；计划时长=考试日期-今天自动推算；
        今日训练=处方引擎输出；打卡+RPE反馈驱动自适应；能力六维真去排课。
   存储：localStorage（仅本机）。 */

const STORE_KEY = 'rcj_training_v3';

const CAPS = [
  { key: '心肺', emoji: '❤️' },
  { key: '力量', emoji: '💪' },
  { key: '爆发', emoji: '⚡' },
  { key: '速度', emoji: '🏃' },
  { key: '灵敏', emoji: '🦵' },
  { key: '恢复', emoji: '🛡' },
];

const ROLES = {
  '深圳辅警': {
    emoji: '👮', desc: '公安素质 + 体测',
    tpl: [
      { name: '1000米跑', type: 'time', cap: '心肺' },
      { name: '10米×4往返跑', type: 'time', cap: '速度' },
      { name: '纵跳摸高', type: 'num', cap: '爆发', unit: 'cm' },
    ],
  },
  '消防员': {
    emoji: '🚒', desc: '综合体能 + 负重',
    tpl: [
      { name: '1000米跑', type: 'time', cap: '心肺' },
      { name: '立定跳远', type: 'num', cap: '爆发', unit: 'cm' },
      { name: '单杠引体向上', type: 'num', cap: '力量', unit: '个' },
      { name: '俯卧撑', type: 'num', cap: '力量', unit: '个' },
    ],
  },
  '入伍': {
    emoji: '🪖', desc: '入伍体测',
    tpl: [
      { name: '3000米跑', type: 'time', cap: '心肺' },
      { name: '俯卧撑', type: 'num', cap: '力量', unit: '个' },
      { name: '引体向上', type: 'num', cap: '力量', unit: '个' },
      { name: '立定跳远', type: 'num', cap: '爆发', unit: 'cm' },
    ],
  },
  '综合体能提升': {
    emoji: '💡', desc: '通用强身',
    tpl: [
      { name: '1000米跑', type: 'time', cap: '心肺' },
      { name: '俯卧撑', type: 'num', cap: '力量', unit: '个' },
      { name: '平板支撑', type: 'num', cap: '力量', unit: '秒' },
      { name: '立定跳远', type: 'num', cap: '爆发', unit: 'cm' },
    ],
  },
};

const WHY_CARDS = [
  { id: 'zone2', icon: '🫁', title: '有氧基础（Zone 2）', tag: '心肺',
    why: '大量低强度持续训练是耐力能力的“地基”。运动科学专家共识：Zone 2 指强度<b>略低于第一乳酸/通气阈</b>的匀速训练，应占耐力训练的大部分比例，能提升心肺效率、线粒体数量和毛细血管密度。',
    do: '用<b>能完整说话、不喘</b>的配速慢跑 30–60 分钟，每周 2–4 次。觉得“太慢没用”恰恰是误区。', one: '慢跑不是偷懒，是在打基础。' },
  { id: 'interval', icon: '⚡', title: '间歇与速度', tag: '速度/心肺',
    why: '高强度(On)+低强度恢复(Off)的循环，能在一节课里堆出比连续跑<b>更多</b>的高强度刺激。长间歇(85–95% 最大摄氧)主要练中心心肺；短冲主要练肌肉氧化能力。',
    do: '例：400米 × 5 组(组间慢跑恢复)；或 4 × 4 分钟(接近阈值)。<b>强度决定时长</b>，别每组都冲到力竭。', one: '快慢交替，才练得到“快”。' },
  { id: 'strength', icon: '💪', title: '力量与爆发', tag: '力量/爆发',
    why: '力量是很多体测项目(引体/俯卧撑/攀爬)的底子；<b>爆发 = 力量 × 速度</b>，靠“又快又用力”的动作(立定跳/纵跳)提升。',
    do: '渐进超负荷——每周少量加重或加次数；爆发动作<b>重质量轻数量</b>，组间充分恢复。', one: '力量是练出来的，不是熬出来的。' },
  { id: 'recovery', icon: '🛡', title: '恢复与防伤', tag: '恢复',
    why: '身体适应发生在<b>恢复阶段</b>，不是训练那一下。睡眠、营养、疲劳监控决定你能不能持续进步；很多考生不是不会练，是练伤了。',
    do: '训练日之间留恢复日；<b>腿酸就降强度不硬扛</b>；睡眠 7–9 小时；训练后拉伸。', one: '练伤了，进度归零。' },
  { id: 'warmup', icon: '🔥', title: '热身', tag: '恢复/防伤',
    why: '热身提升肌肉温度与关节活动度，<b>降低拉伤风险</b>，让神经肌肉为高强度准备好。',
    do: '动态热身(高抬腿/开合跳/关节绕环)5–10 分钟，再进主训练；避免一上来就猛冲。', one: '不热身，等于没上保险。' },
  { id: 'period', icon: '🗓', title: '周期化', tag: '全局',
    why: '把训练分成周期(基础期→强化期→冲刺期→减量期)，让<b>刺激和恢复交替</b>，避免长期停滞和过度训练。',
    do: '离考试远时打基础(Zone2/力量)，临近时加专项强度与模拟测试，考前一周减量保状态。', one: '会排期的人，比猛练的人走得更远。' },
];

const TRAIN_DAYS = [1, 2, 4, 6]; // 周一/二/四/六 训练，其余休息
const WEEKDAY = ['周日','周一','周二','周三','周四','周五','周六'];

/* ---------- 工具 ---------- */
const uid = () => Math.random().toString(36).slice(2, 9);
const $ = id => document.getElementById(id);

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && s.goal) return s;
  } catch (e) {}
  return {
    goal: { role: '深圳辅警', examDate: '', noDate: false, manualWeeks: 4, loadAdj: 1, items: [] },
    tests: [], plan: null, checkins: {},
  };
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

function fmtTime(sec) {
  if (sec == null || isNaN(sec)) return '';
  sec = Math.round(sec);
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function parseVal(str, type) {
  if (str == null) return null;
  str = String(str).trim();
  if (!str) return null;
  if (type === 'time') {
    if (str.includes(':')) {
      const [m, s] = str.split(':');
      return (parseInt(m, 10) || 0) * 60 + (parseInt(s, 10) || 0);
    }
    return parseFloat(str) || null;
  }
  return parseFloat(str) || null;
}
function fmtVal(v, type, unit) {
  if (v == null) return '—';
  return type === 'time' ? fmtTime(v) : (unit ? `${v}${unit}` : `${v}`);
}
function dispTarget(item) {
  if (item.target == null) return '未设';
  return fmtVal(item.target, item.type, item.unit);
}

let state = load();

/* ---------- 测试历史 ---------- */
function sortedTests() { return [...state.tests].sort((a, b) => a.date.localeCompare(b.date)); }
function itemHistory(itemId) {
  const out = [];
  sortedTests().forEach(t => {
    if (itemId in t.values && t.values[itemId] != null) out.push({ date: t.date, v: t.values[itemId] });
  });
  return out;
}
function itemProgress(item) {
  const h = itemHistory(item.id);
  if (!item.target || h.length < 1) return null;
  const base = h[0].v, cur = h[h.length - 1].v, T = item.target;
  let p;
  if (item.type === 'time') { if (base === T) return cur <= T ? 1 : 0; p = (base - cur) / (base - T); }
  else { if (base === T) return cur >= T ? 1 : 0; p = (cur - base) / (T - base); }
  return Math.max(0, Math.min(1, p));
}
function gapText(item) {
  const h = itemHistory(item.id);
  if (!item.target || !h.length) return { txt: '未设目标', ok: false };
  const cur = h[h.length - 1].v, T = item.target;
  if (item.type === 'time') {
    if (cur <= T) return { txt: '已达标 ✓', ok: true };
    const d = Math.round(T - cur);
    return { txt: `还差 ${d >= 60 ? fmtTime(d) : d + '秒'}`, ok: false };
  } else {
    if (cur >= T) return { txt: '已达标 ✓', ok: true };
    return { txt: `还差 ${Math.round(T - cur)}${item.unit || ''}`, ok: false };
  }
}
function sparkline(hist) {
  if (hist.length === 0) return '';
  const w = 240, hgt = 34, pad = 3;
  const vals = hist.map(p => p.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const pts = hist.map((p, i) => {
    const x = pad + i * (w - 2 * pad) / Math.max(1, hist.length - 1);
    const y = hgt - pad - (p.v - min) / span * (hgt - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${hgt}" preserveAspectRatio="none">
    <polyline points="${pts}" fill="none" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/>
    ${hist.map((p, i) => {
      const x = pad + i * (w - 2 * pad) / Math.max(1, hist.length - 1);
      const y = hgt - pad - (p.v - min) / span * (hgt - 2 * pad);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="#2563eb"/>`;
    }).join('')}
  </svg>`;
}

/* ---------- 弱项计算（驱动排课） ---------- */
function computeWeakCaps() {
  const scored = CAPS.map(c => {
    const items = state.goal.items.filter(i => i.cap === c.key);
    if (!items.length) return { cap: c.key, score: 0 };
    let tot = 0, n = 0;
    items.forEach(it => {
      const h = itemHistory(it.id);
      if (it.target != null && h.length) {
        const cur = h[h.length - 1].v, T = it.target;
        let gap = it.type === 'time' ? (cur - T) / (cur || 1) : (T - cur) / (T || 1);
        tot += Math.max(0, gap); n++;
      }
    });
    return { cap: c.key, score: n ? tot / n : 0 };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.map(x => x.cap);
}

/* ---------- 处方引擎：生成单次训练 ---------- */
function itemsOfCap(cap) { return state.goal.items.filter(i => i.cap === cap); }

function genSession(cap, phase, load) {
  const items = itemsOfCap(cap);
  const w = load; // 0.75–1.3
  let title, actions = [], purpose = '', kid = '';
  const cardio = items.find(i => i.type === 'time');
  const strength = items.find(i => /俯卧撑|引体|push|平板/i.test(i.name || ''));

  switch (cap) {
    case '心肺': {
      if (phase === 'base') {
        const mins = Math.round((35 + (cardio ? 5 : 0)) * (0.85 + 0.15 * w));
        title = '有氧基础日';
        actions = [`慢跑 ${mins} 分钟（能完整说话的配速，Zone 2）`, '跑后慢走 5 分钟降温'];
        purpose = '打有氧地基：提升心肺效率与线粒体能力';
        kid = 'zone2';
      } else if (phase === 'build') {
        const reps = Math.max(4, Math.round(5 * w));
        title = '间歇速度日';
        actions = [`${cardio ? cardio.name : '400米'} × ${reps} 组，组间慢跑恢复 90 秒`, '热身 8 分钟 + 冷身 5 分钟'];
        purpose = '快慢交替堆出更多高强度刺激，练速度/最大摄氧';
        kid = 'interval';
      } else {
        const it = cardio || items[0];
        title = '模拟测试日';
        actions = [`按考试节奏完成一次 ${it ? it.name : '主项'} 全力测试`, '记录成绩，对比目标'];
        purpose = '把训练成果在接近考场条件下检验';
        kid = 'period';
      }
      break;
    }
    case '力量': {
      if (phase === 'base') {
        const sets = 4, reps = Math.max(8, Math.round(10 * w));
        title = '力量基础日';
        actions = [`${strength ? strength.name : '上肢力量'} ${sets} 组 × ${reps} 次（组间休息 60–90 秒）`];
        purpose = '渐进建立上肢力量底子'; kid = 'strength';
      } else if (phase === 'build') {
        const sets = 5, reps = Math.max(6, Math.round(8 * w));
        title = '力量强化日';
        actions = [`主项力量 ${sets} 组 × ${reps} 次，逐步加次数`, '最后加 1 组力竭并记录'];
        purpose = '在基础期上加重，逼近目标次数'; kid = 'strength';
      } else {
        title = '力量保持日';
        actions = ['主项力量 3 组 × 目标次数，保持手感'];
        purpose = '考前保持，不过度消耗'; kid = 'period';
      }
      break;
    }
    case '爆发': {
      const jumps = Math.max(4, Math.round(6 * w));
      title = phase === 'peak' ? '爆发保持日' : (phase === 'build' ? '爆发强化日' : '爆发基础日');
      actions = [`立定跳远 / 纵跳 ${jumps} 组 × 3–5 次（重质量轻数量，组间充分休息）`];
      purpose = '提升力量×速度的爆发输出'; kid = 'strength';
      break;
    }
    case '速度':
    case '灵敏': {
      const reps = Math.max(4, Math.round(6 * w));
      title = phase === 'peak' ? '速度保持日' : (phase === 'build' ? '速度强化日' : '速度基础日');
      actions = [`10米×4 折返跑 ${reps} 组（全力，组间走回恢复）`];
      purpose = '练起动与变向速度'; kid = 'interval';
      break;
    }
    case '恢复': {
      title = '恢复日';
      actions = ['动态拉伸 15 分钟（腿/背/肩）', '可选：轻松散步 20 分钟或完全休息'];
      purpose = '适应发生在恢复阶段，防伤防过度训练'; kid = 'recovery';
      break;
    }
  }
  return { cap, phase, title, actions, purpose, kid };
}

/* ---------- 计划生成（动态时长） ---------- */
function genPlan() {
  const g = state.goal;
  let weeks;
  if (!g.noDate && g.examDate) {
    const ms = new Date(g.examDate + 'T00:00:00') - new Date();
    weeks = Math.ceil(ms / (7 * 864e5));
  } else {
    weeks = g.manualWeeks || 4;
  }
  weeks = Math.max(2, Math.min(16, weeks || 2));
  g.planWeeks = weeks;

  // 阶段分配
  let phases = [];
  if (weeks <= 3) {
    phases = Array(weeks).fill('peak');
    phases[phases.length - 1] = 'taper';
  } else {
    let base = Math.max(1, Math.round(weeks * 0.4));
    let build = Math.max(1, Math.round(weeks * 0.35));
    let peak = weeks - base - build;
    if (peak < 1) { peak = 1; if (base > build) base--; else build--; }
    phases = [...Array(base).fill('base'), ...Array(build).fill('build'), ...Array(peak).fill('peak')];
    phases[phases.length - 1] = 'taper';
  }

  const weak = computeWeakCaps();
  const capOrder = weak.length ? weak : CAPS.map(c => c.key);
  const load = g.loadAdj || 1;

  const startDate = state.plan ? state.plan.startDate : new Date().toISOString().slice(0, 10);
  const plan = { generatedAt: Date.now(), startDate, weeks: [] };
  for (let w = 0; w < weeks; w++) {
    const phase = phases[w];
    const sessions = TRAIN_DAYS.map((d, idx) => {
      let cap;
      if (phase === 'taper' && idx === TRAIN_DAYS.length - 1) cap = '恢复';
      else if (idx === TRAIN_DAYS.length - 1 && w % 2 === 1) cap = '恢复';
      else cap = capOrder[(w + idx) % capOrder.length];
      const s = genSession(cap, phase, load);
      s.dayLabel = WEEKDAY[d];
      return s;
    });
    plan.weeks.push({ week: w + 1, phase, sessions });
  }
  state.plan = plan;
  save();
}

/* ---------- 今日训练 ---------- */
function todaySession() {
  if (!state.plan) return null;
  const start = new Date(state.plan.startDate + 'T00:00:00');
  const days = Math.floor((Date.now() - start) / 864e5);
  let w = Math.floor(days / 7);
  if (w >= state.plan.weeks.length) w = state.plan.weeks.length - 1;
  if (w < 0) w = 0;
  const dow = new Date().getDay();
  const idx = TRAIN_DAYS.indexOf(dow);
  const weekObj = state.plan.weeks[w];
  if (idx < 0) return { rest: true, week: w, session: weekObj.sessions[0] };
  return { rest: false, week: w, idx, session: weekObj.sessions[idx] };
}
function checkKey(t) { return state.plan.startDate + '-W' + t.week + '-' + t.idx; }
function isCheckedIn(t) { return !!(state.checkins && state.checkins[checkKey(t)]); }

function renderToday() {
  const box = $('todayBox');
  if (!state.plan) {
    box.innerHTML = `<div class="today-rest"><div class="r-emoji">🎯</div><h3>还没有计划</h3>
      <p>先去「我的目标」选角色、填考试日期和目标，一键生成你的训练计划。</p></div>`;
    return;
  }
  const t = todaySession();
  const wk = state.plan.weeks[t.week];

  if (t.rest) {
    box.innerHTML = `<div class="today-rest"><div class="r-emoji">🌿</div>
      <h3>今天休息日</h3><p>第 ${wk.week} 周 · ${phaseName(wk.phase)}。身体在恢复中变强，别硬练。</p>
      <div class="next-preview"><b>下一次训练：</b>${t.session.title}（${t.session.dayLabel}）<br>${t.session.actions[0]}</div></div>`;
    return;
  }

  if (isCheckedIn(t)) {
    const next = nextSessionPreview(t);
    box.innerHTML = `<div class="today-done"><div class="d-badge">今日已打卡 ✓</div>
      <div class="d-emoji">💪</div><h3>${t.session.title}</h3>
      <p>RPE ${state.checkins[checkKey(t)].rpe}/5 · ${phaseName(wk.phase)}</p>
      ${next ? `<div class="next-preview"><b>下次训练：</b>${next}</div>` : ''}</div>`;
    return;
  }

  const s = t.session;
  const card = `<div class="today-card">
    <span class="today-cap">${CAPS.find(c => c.key === s.cap).emoji}${s.cap} · 第 ${wk.week} 周 ${phaseName(wk.phase)}</span>
    <h3 class="today-title">${s.title}</h3>
    <p class="today-purpose">${s.purpose}</p>
    <ul class="today-actions">${s.actions.map(a => `<li>${a}</li>`).join('')}</ul>
    ${knowledgeInline(s.kid)}
  </div>
  <div class="checkin">
    <div class="checkin-label">完成后顺便给个强度反馈（帮计划自适应调整）：</div>
    <div class="rpe-row" id="rpeRow">
      ${[1,2,3,4,5].map(n => `<button class="rpe-btn" data-rpe="${n}">${rpeLabel(n)}</button>`).join('')}
    </div>
    <div class="rpe-scale"><span>太轻松</span><span>刚好</span><span>太难</span></div>
  </div>`;
  box.innerHTML = card;
  $('rpeRow').querySelectorAll('.rpe-btn').forEach(b => b.onclick = () => {
    b.parentElement.querySelectorAll('.rpe-btn').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    checkIn(parseInt(b.dataset.rpe, 10));
  });
}
function rpeLabel(n) {
  return { 1: '轻松', 2: '偏易', 3: '刚好', 4: '偏难', 5: '力竭' }[n];
}
function phaseName(p) {
  return { base: '基础期', build: '强化期', peak: '冲刺期', taper: '减量期' }[p] || p;
}
function knowledgeInline(kid) {
  const c = WHY_CARDS.find(x => x.id === kid);
  if (!c) return '';
  return `<div class="today-know"><b>${c.icon} ${c.title}：</b>${c.why}
    <span class="tk-one">${c.one}</span></div>`;
}
function nextSessionPreview(t) {
  const weeks = state.plan.weeks;
  // 找今天之后的下一个训练日
  for (let d = 1; d <= 7; d++) {
    const dt = new Date(); dt.setDate(dt.getDate() + d);
    const di = TRAIN_DAYS.indexOf(dt.getDay());
    if (di >= 0) {
      const w = Math.min(weeks.length - 1, Math.floor((Math.floor((Date.now() + d * 864e5) - new Date(state.plan.startDate)) / 864e5) / 7));
      const s = weeks[w] && weeks[w].sessions[di];
      if (s) return `${WEEKDAY[dt.getDay()]} · ${s.title}`;
    }
  }
  return '';
}
function checkIn(rpe) {
  const t = todaySession();
  if (!t || t.rest) return;
  state.checkins = state.checkins || {};
  state.checkins[checkKey(t)] = { rpe, date: new Date().toISOString().slice(0, 10) };
  const adj = state.goal.loadAdj || 1;
  if (rpe <= 2) state.goal.loadAdj = Math.min(1.3, adj + 0.08);
  else if (rpe >= 4) state.goal.loadAdj = Math.max(0.75, adj - 0.08);
  save();
  genPlan();      // 用新 loadAdj 重排后续周
  renderToday();
}

/* ---------- 渲染：我的目标 ---------- */
function renderRoles() {
  $('roleGrid').innerHTML = Object.entries(ROLES).map(([name, r]) => `
    <button class="role-card ${state.goal.role === name ? 'active' : ''}" data-role="${name}">
      <div class="rc-emoji">${r.emoji}</div>
      <div class="rc-name">${name}</div>
      <div class="rc-desc">${r.desc}</div>
    </button>`).join('');
  $('roleGrid').querySelectorAll('.role-card').forEach(b => b.onclick = () => {
    state.goal.role = b.dataset.role; save(); renderRoles();
    $('tplRoleName').textContent = b.dataset.role;
  });
  $('tplRoleName').textContent = state.goal.role;
}
function renderGoalItems() {
  const wrap = $('goalItems');
  if (!state.goal.items.length) {
    wrap.innerHTML = '<p class="hint">还没有目标项。点下方「添加」或「载入参考项目」。</p>';
    return;
  }
  wrap.innerHTML = state.goal.items.map(it => `
    <div class="gitem" data-id="${it.id}">
      <div class="gi-top">
        <input class="gi-name" value="${it.name || ''}" placeholder="项目名，如 1000米跑" />
        <button class="gi-del" title="删除">×</button>
      </div>
      <div class="gi-row">
        <select class="gi-type">
          <option value="num" ${it.type === 'num' ? 'selected' : ''}>次数/距离（越多越好）</option>
          <option value="time" ${it.type === 'time' ? 'selected' : ''}>时间（越小越好）</option>
        </select>
        <select class="gi-cap">
          ${CAPS.map(c => `<option value="${c.key}" ${it.cap === c.key ? 'selected' : ''}>${c.emoji}${c.key}</option>`).join('')}
        </select>
      </div>
      <div class="gi-row">
        <span class="gi-cap">${CAPS.find(c => c.key === it.cap).emoji}${it.cap}</span>
        <input class="gi-target" value="${it.target != null ? (it.type === 'time' ? fmtTime(it.target) : it.target) : ''}" placeholder="目标值" />
        <span class="gi-unit">${it.unit || ''}</span>
      </div>
    </div>`).join('');

  wrap.querySelectorAll('.gitem').forEach(row => {
    const id = row.dataset.id;
    const it = state.goal.items.find(x => x.id === id);
    row.querySelector('.gi-name').oninput = e => { it.name = e.target.value; save(); };
    row.querySelector('.gi-type').onchange = e => { it.type = e.target.value; save(); renderGoalItems(); };
    row.querySelector('.gi-cap').onchange = e => { it.cap = e.target.value; save(); renderGoalItems(); };
    row.querySelector('.gi-target').oninput = e => { it.target = parseVal(e.target.value, it.type); save(); };
    row.querySelector('.gi-del').onclick = () => {
      state.goal.items = state.goal.items.filter(x => x.id !== id); save(); renderGoalItems();
    };
  });
}
function renderPlanSummary() {
  const el = $('planSummary');
  if (!state.plan) { el.hidden = true; return; }
  const g = state.goal;
  const weeks = state.plan.weeks;
  const baseN = weeks.filter(w => w.phase === 'base').length;
  const buildN = weeks.filter(w => w.phase === 'build').length;
  const peakN = weeks.filter(w => w.phase === 'peak').length;
  const taperN = weeks.filter(w => w.phase === 'taper').length;
  const src = (!g.noDate && g.examDate)
    ? `根据你的考试日期 <b>${g.examDate}</b> 自动推算（${weeks.length} 周）。`
    : `滚动训练模式，当前 ${weeks.length} 周，可在上方调整。`;
  el.hidden = false;
  el.innerHTML = `<div class="ps-head"><span>我的训练计划</span>
      <span class="ps-phase">共 ${weeks.length} 周</span></div>
    <div class="ps-note">${src} 阶段：基础期 ${baseN} · 强化期 ${buildN} · 冲刺期 ${peakN} · 减量期 ${taperN}。弱项会多排对应训练。</div>
    <div class="ps-weeks">
      ${weeks.map(w => `<div class="ps-week"><span class="wk-no">第${w.week}周</span>
        <span class="wk-phase">${phaseName(w.phase)}</span>
        <span class="wk-focus">${w.sessions.map(s => s.cap).join('·')}</span></div>`).join('')}
    </div>`;
}

/* ---------- 渲染：我的测试 ---------- */
function renderTest() {
  const wrap = $('testItems');
  const items = state.goal.items;
  $('testEmpty').hidden = items.length > 0;
  $('saveTestBtn').hidden = items.length === 0;
  if (!items.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = items.map(it => `
    <div class="titem" data-id="${it.id}">
      <span class="ti-name">${it.name || '未命名'}</span>
      <span class="ti-cap">${CAPS.find(c => c.key === it.cap).emoji}${it.cap}</span>
      <input type="text" inputmode="decimal" placeholder="实测" />
      <span class="ti-unit">${it.unit || (it.type === 'time' ? 'm:ss' : '')}</span>
    </div>`).join('');
}

/* ---------- 渲染：成长档案 ---------- */
function renderGrowth() {
  $('capRadar').innerHTML = CAPS.map(c => {
    const rel = state.goal.items.filter(it => it.cap === c.key);
    let progSum = 0, n = 0;
    rel.forEach(it => { const p = itemProgress(it); if (p != null) { progSum += p; n++; } });
    const pct = n ? Math.round(progSum / n * 100) : 0;
    return `<div class="crad">
      <span class="cr-name">${c.emoji}${c.key}</span>
      <span class="cr-track"><span class="cr-fill" style="width:${pct}%"></span></span>
      <span class="cr-val ${pct >= 100 ? 'done' : ''}">${n ? pct + '%' : '—'}</span>
    </div>`;
  }).join('');

  const list = $('growthList');
  const items = state.goal.items;
  if (!items.length) { list.innerHTML = '<p class="empty-tip">先在「我的目标」添加项目。</p>'; return; }
  const withData = items.filter(it => itemHistory(it.id).length > 0);
  if (!withData.length) { list.innerHTML = '<p class="empty-tip">还没有测试记录。去「我的测试」记一次吧。</p>'; return; }
  list.innerHTML = withData.map(it => {
    const h = itemHistory(it.id);
    const g = gapText(it);
    const first = h[0].v, last = h[h.length - 1].v;
    return `<div class="gcard">
      <div class="gc-head"><span class="gc-name">${it.name || '未命名'}</span>
        <span class="gc-cap">${CAPS.find(c => c.key === it.cap).emoji}${it.cap}</span></div>
      <div class="gc-gap ${g.ok ? 'ok' : 'miss'}">${g.txt}</div>
      <div class="gc-meta">目标 ${dispTarget(it)} · 实测 ${fmtVal(last, it.type, it.unit)}（首次 ${fmtVal(first, it.type, it.unit)}）· 共 ${h.length} 次</div>
      ${sparkline(h)}
    </div>`;
  }).join('');
}

/* ---------- 渲染：科学训练 ---------- */
function renderWhy() {
  $('whyCards').innerHTML = WHY_CARDS.map(c => `
    <div class="kcard">
      <h4>${c.icon} ${c.title} <span class="kc-tag">${c.tag}</span></h4>
      <p class="kc-why">${c.why}</p>
      <p class="kc-do">▸ ${c.do}</p>
      <div class="kc-one">${c.one}</div>
    </div>`).join('');
}

/* ---------- 事件 ---------- */
$('examDate').value = state.goal.examDate || '';
$('examDate').onchange = e => { state.goal.examDate = e.target.value; state.goal.noDate = false; $('noDate').checked = false; $('weeksWrap').hidden = true; save(); };
$('noDate').onchange = e => {
  state.goal.noDate = e.target.checked;
  if (e.target.checked) { $('examDate').value = ''; state.goal.examDate = ''; $('weeksWrap').hidden = false; }
  else $('weeksWrap').hidden = true;
  save();
};
$('weeksRange').oninput = e => { $('weeksVal').textContent = e.target.value; };
$('weeksRange').onchange = e => { state.goal.manualWeeks = parseInt(e.target.value, 10); save(); };
if (state.goal.noDate) { $('noDate').checked = true; $('weeksWrap').hidden = false; $('weeksRange').value = state.goal.manualWeeks || 4; $('weeksVal').textContent = state.goal.manualWeeks || 4; }

$('addItemBtn').onclick = () => {
  state.goal.items.push({ id: uid(), name: '', type: 'num', cap: '心肺', target: null, unit: '' });
  save(); renderGoalItems();
};
$('tplBtn').onclick = () => {
  const tpl = ROLES[state.goal.role].tpl;
  state.goal.items = tpl.map(t => ({ id: uid(), name: t.name, type: t.type, cap: t.cap, target: null, unit: t.unit || '' }));
  save(); renderGoalItems();
  $('goalSaved').textContent = '已载入参考项目，数值请填你当地公告';
};
$('genPlanBtn').onclick = () => {
  genPlan();
  renderPlanSummary(); renderToday();
  $('goalSaved').textContent = '计划已生成 ✓ 去「今日训练」开练';
  setTimeout(() => $('goalSaved').textContent = '', 2200);
  // 切到今日训练
  document.querySelector('.tab[data-tab="today"]').click();
};

$('testDate').value = new Date().toISOString().slice(0, 10);
$('saveTestBtn').onclick = () => {
  const date = $('testDate').value || new Date().toISOString().slice(0, 10);
  const values = {}; let any = false;
  document.querySelectorAll('#testItems .titem').forEach(row => {
    const id = row.dataset.id, it = state.goal.items.find(x => x.id === id);
    const v = parseVal(row.querySelector('input').value, it.type);
    if (v != null) { values[id] = v; any = true; }
  });
  if (!any) { alert('至少填一项实测成绩'); return; }
  const exist = state.tests.find(t => t.date === date);
  if (exist) exist.values = { ...exist.values, ...values };
  else state.tests.push({ id: uid(), date, values });
  save();
  renderTest(); renderGrowth();
  $('saveTestBtn').textContent = '已保存 ✓';
  setTimeout(() => $('saveTestBtn').textContent = '保存这次测试', 1500);
};

$('exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `RCJ-Training-${state.goal.role}.json`;
  a.click();
};

/* 底部导航 */
document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  const tab = t.dataset.tab;
  document.querySelectorAll('[data-panel]').forEach(p => p.hidden = true);
  $('panel-' + tab).hidden = false;
  if (tab === 'test') renderTest();
  if (tab === 'growth') renderGrowth();
  if (tab === 'today') renderToday();
  window.scrollTo(0, 0);
});

/* 初始渲染 */
renderRoles();
renderGoalItems();
renderWhy();
renderPlanSummary();
if (state.plan) { document.querySelector('.tab[data-tab="today"]').click(); }
