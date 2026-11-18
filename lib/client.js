window.__ModuleLoader__.load({
  id: 'dsh-plugin-skymoni',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const PANEL = 'skymoni-account';
    const TITLE = 'Skymoni 账户登录';
    const SITE = 'https://skymoni.com';
    const STYLES = `
.skymoni-panel {
  height:100%; overflow:auto; box-sizing:border-box; padding:30px clamp(16px,4vw,48px) 48px;
  color:var(--dsw-alias-label-primary,#111418); font:14px/1.5 system-ui,"Microsoft YaHei",sans-serif;
  --sky-muted:var(--dsw-alias-label-secondary,#737982);
  --sky-border:var(--dsw-alias-border-l3,#dcdde0);
  --sky-base:var(--dsw-alias-bg-base,#fff);
  --sky-soft:color-mix(in srgb,currentColor 5%,var(--sky-base));
}
.skymoni-panel * { box-sizing:border-box; }
.skymoni-panel .sky-body { max-width:1160px; margin-inline:auto; min-width:0; }
.skymoni-panel h1 { font-size:clamp(25px,3vw,34px); line-height:1.15; margin:0; font-weight:750; }
.skymoni-panel h2 { font-size:17px; font-weight:700; margin:0; }
.skymoni-panel p { margin:4px 0 0; }
.skymoni-panel .sky-muted { color:var(--sky-muted); }
.skymoni-panel .sky-header, .skymoni-panel .sky-flex {
  display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px 16px;
}
.skymoni-panel .sky-header { margin-bottom:20px; align-items:flex-start; }
.skymoni-panel .sky-actions { display:flex; gap:7px; flex-wrap:wrap; align-items:center; }
.skymoni-panel :is(button,select,input) { font:inherit; color:inherit; }
.skymoni-panel :is(.sky-button,select,input) {
  border:1px solid var(--sky-border); border-radius:8px; padding:6px 10px; max-width:100%;
}
.skymoni-panel .sky-button { display:inline-flex; align-items:center; justify-content:center; gap:6px;
  background:transparent; color:inherit; text-decoration:none; cursor:pointer; }
.skymoni-panel .sky-button:hover:not(:disabled), .skymoni-panel :is(select,input,.sky-segments) { background:var(--sky-soft); }
.skymoni-panel :is(.sky-primary, .sky-segments button[aria-pressed="true"]) {
  background:var(--dsw-alias-label-primary,#101216); color:var(--sky-base); border-color:transparent;
}
.skymoni-panel .sky-primary:hover:not(:disabled) { background:var(--dsw-alias-label-primary,#101216); opacity:.86; }
.skymoni-panel button:disabled { opacity:.48; cursor:default; }
.skymoni-panel :focus-visible { outline:2px solid var(--dsw-alias-state-business-primary,#487af8); outline-offset:2px; }
.skymoni-panel .sky-box { border:1px solid var(--sky-border); border-radius:12px; }
.skymoni-panel .sky-balance { background:var(--sky-soft); padding:clamp(18px,3vw,28px); }
.skymoni-panel .sky-amount { display:flex; align-items:center; gap:10px; font-size:clamp(24px,4vw,36px);
  font-weight:720; line-height:1.25; margin-block:8px; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
.skymoni-panel .sky-credit { flex:none; font-size:.8em; line-height:1; }
.skymoni-panel .sky-stats { display:grid; grid-template-columns:1fr 1fr; margin:18px 0 26px; }
.skymoni-panel .sky-stats > div { padding-inline:4px 12px; min-width:0; }
.skymoni-panel .sky-stats > div + div { padding-inline-start:24px; border-inline-start:1px solid var(--sky-border); }
.skymoni-panel .sky-stats dt { color:var(--sky-muted); }
.skymoni-panel .sky-stats dd { margin:4px 0 0; font-size:17px; font-weight:640; overflow-wrap:anywhere; }
.skymoni-panel .sky-checkin, .skymoni-panel .sky-login, .skymoni-panel .sky-subscriptions { padding:15px 18px; }
.skymoni-panel .sky-checkin { margin-block:24px 28px; }
.skymoni-panel .sky-subscriptions { margin-top:20px; }
.skymoni-panel .sky-subscriptions .sky-flex { margin-top:8px; }
.skymoni-panel .sky-checked { font-weight:650; color:var(--dsw-alias-label-primary,#236943); }
.skymoni-panel .sky-section { margin-top:28px; }
.skymoni-panel .sky-section > .sky-flex { margin-bottom:12px; }
.skymoni-panel .sky-scroll { overflow-x:auto; }
.skymoni-panel .sky-calendar { padding:12px 14px; }
.skymoni-panel .sky-grid {
  display:grid; grid-template-columns:22px repeat(var(--sky-weeks),minmax(10px,1fr));
  grid-template-rows:20px repeat(7,clamp(10px,1.6vw,16px)); gap:3px;
}
.skymoni-panel .sky-month, .skymoni-panel .sky-weekday { color:var(--sky-muted); font-size:11px; white-space:nowrap; }
.skymoni-panel .sky-weekday { align-self:center; }
.skymoni-panel .sky-day, .skymoni-panel .sky-swatch {
  background:var(--sky-soft); border:1px solid var(--sky-border); border-radius:3px;
}
.skymoni-panel .sky-day { min-width:0; min-height:0; padding:0; cursor:pointer; }
.skymoni-panel .sky-day[aria-pressed="true"] { outline:2px solid currentColor; outline-offset:0; }
.skymoni-panel :is(.sky-day,.sky-swatch)[data-level="1"] { background:#a5e2b3; border-color:#69bf82; }
.skymoni-panel :is(.sky-day,.sky-swatch)[data-level="2"] { background:#55be75; border-color:#43935a; }
.skymoni-panel :is(.sky-day,.sky-swatch)[data-level="3"] { background:#309450; border-color:#16723b; }
.skymoni-panel :is(.sky-day,.sky-swatch)[data-level="4"] { background:#1a6437; border-color:#144b2b; }
.skymoni-panel .sky-calendar-meta { margin-block:12px 8px; font-size:12px; }
.skymoni-panel .sky-legend { display:flex; align-items:center; gap:4px; font-size:12px; margin-top:9px; }
.skymoni-panel .sky-swatch { width:12px; height:12px; }
.skymoni-panel .sky-segments { display:flex; gap:3px; padding:3px; border-radius:8px; }
.skymoni-panel .sky-segments button { border:0; background:transparent; border-radius:5px; padding:4px 9px; cursor:pointer; }
.skymoni-panel .sky-dates { display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
.skymoni-panel input[type="date"] { min-width:0; width:132px; }
.skymoni-panel .sky-summary { margin:12px 0; }
.skymoni-panel .sky-export-path { overflow-wrap:anywhere; user-select:text; }
.skymoni-panel .sky-empty { text-align:center; padding:26px 12px; }
.skymoni-panel table { width:100%; border-collapse:collapse; text-align:left; }
.skymoni-panel :is(th,td) { padding:8px 12px; overflow-wrap:anywhere; }
.skymoni-panel :is(th,tr + tr) { border-bottom:1px solid var(--sky-border); }
.skymoni-panel .sky-pages { margin-top:10px; }
.skymoni-panel .sky-error { color:var(--dsw-alias-text-danger,#a64221); margin:8px 0; }
.skymoni-panel .sky-account { padding-top:18px; border-top:1px solid var(--sky-border); margin-top:28px; }
@media(max-width:520px) {
  .skymoni-panel .sky-header .sky-actions { width:100%; }
  .skymoni-panel .sky-dates input { width:122px; padding-inline:5px; }
}
`;

    const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dateAt = (date, days) => new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
    const formatter = new Intl.NumberFormat('zh-CN');
    const number = value => typeof value === 'number' ? formatter.format(value) :
      typeof value === 'string' && /^-?\d+$/.test(value) ? formatter.format(BigInt(value)) : '—';
    const button = (text, props) => h('button', { type: 'button', className: 'sky-button', ...props }, text);
    const link = (text, path, extra = {}) => h('a', {
      className: 'sky-button', href: SITE + path, target: '_blank', rel: 'noopener noreferrer', ...extra,
    }, text);

    function Avatar({ size = 18 }) {
      const shape = { position: 'absolute', left: '50%', transform: 'translateX(-50%)', background: 'currentColor' };
      return h('span', { 'aria-hidden': true, style: {
        display: 'inline-block', position: 'relative', boxSizing: 'border-box', width: size, height: size,
        border: '1.2px solid currentColor', borderRadius: '50%', flexShrink: 0,
      } },
      h('span', { style: { ...shape, top: '19%', width: '29%', height: '29%', borderRadius: '50%' } }),
      h('span', { style: { ...shape, top: '55%', width: '54%', height: '23%', borderRadius: '50% 50% 25% 25%' } }));
    }

    async function call(ctx, action, signal, payload = {}) {
      const result = await ctx.connection.rpc.call('/api', `skymoni-account/${action}`, payload, signal);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    }

    function Checkin({ state, phase, busy, act, returning }) {
      const info = state.checkin;
      let detail = '正在读取签到状态…';
      if (state.checkinError) detail = state.checkinError;
      else if (info?.enabled === false) detail = '签到功能暂未开放。';
      else if (info?.enabled) {
        detail = `本月已签到 ${info.monthCount} 天 · 累计 ${info.totalCount} 天`;
        if (info.checkedIn && info.awardLabel && info.awardLabel !== '—') detail += ` · 今日获得 ${info.awardLabel}`;
        if (info.requiresVerification && !info.checkedIn) detail += ' · 今日需在官网完成验证';
      }
      return h('section', { className: 'sky-box sky-checkin sky-flex', 'aria-labelledby': 'sky-checkin-title' },
        h('div', null, h('h2', { id: 'sky-checkin-title' }, '每日签到'),
          h('p', { role: 'status', className: state.checkinError ? 'sky-error' : 'sky-muted' }, detail)),
        h('div', { className: 'sky-actions' },
          link(info?.requiresVerification && !info.checkedIn ? '去官网验证并签到' : '签到记录', '/checkin', {
            onClick: () => { returning.current = true; },
          }),
          info?.enabled && (info.checkedIn
            ? h('span', { className: 'sky-checked' }, '✓ 今日已签到')
            : !info.requiresVerification && button(phase === 'checkin' ? '正在签到…' : '立即签到', {
              className: 'sky-button sky-primary', disabled: busy, onClick: () => act('checkin'),
            }))));
    }

    function Calendar({ activity, today, selected, choose }) {
      const [days, setDays] = React.useState(365);
      const [metric, setMetric] = React.useState('requests');
      const [focused, setFocused] = React.useState(null);
      const start = dateAt(today, 1 - days);
      const offset = (new Date(start + 'T00:00:00Z').getUTCDay() + 6) % 7;
      const weeks = Math.ceil((offset + days) / 7);
      const dates = Array.from({ length: days }, (_, index) => dateAt(start, index));
      const cells = dates.map(date => activity.get(date)?.[metric] ?? 0);
      const max = Math.max(1, ...cells);
      const active = dates.filter(date => activity.has(date));
      const requests = active.reduce((total, date) => total + activity.get(date).requests, 0);
      const keyboardDate = [focused, selected, today].find(date => date && date >= start && date <= today);
      const months = new Map();
      for (const [index, date] of dates.entries()) {
        if (index === 0 || date.endsWith('-01')) months.set(Math.floor((index + offset) / 7), Number(date.slice(5, 7)));
      }
      function move(event, date) {
        const direction = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[event.key];
        if (!direction) return;
        event.preventDefault();
        const nextDate = dateAt(date, direction);
        event.currentTarget.parentElement.querySelector(`[data-date="${nextDate}"]`)?.focus();
      }
      return h('section', { className: 'sky-section', 'aria-labelledby': 'sky-calendar-title' },
        h('div', { className: 'sky-flex' },
          h('div', null, h('h2', { id: 'sky-calendar-title' }, '使用日历'),
            h('p', { className: 'sky-muted' }, `${number(active.length)} 个活跃日 · ${number(requests)} 次已记录请求`)),
          h('div', { className: 'sky-actions' },
            h('select', { 'aria-label': '日历时间范围', value: days, onChange: event => setDays(Number(event.target.value)) },
              h('option', { value: 365 }, '近一年'), h('option', { value: 90 }, '近 90 天')),
            h('select', { 'aria-label': '日历统计指标', value: metric, onChange: event => setMetric(event.target.value) },
              h('option', { value: 'requests' }, '请求次数'), h('option', { value: 'tokens' }, '已知 Token 用量')))),
        h('div', { className: 'sky-flex sky-muted sky-calendar-meta' }, h('span', null, `${start} — ${today}`), h('span', null, '本机记录')),
        h('div', { className: 'sky-box sky-scroll sky-calendar' },
          h('div', { className: 'sky-grid', style: { '--sky-weeks': weeks, minWidth: 22 + 13 * weeks } },
            [...months].map(([col, month]) => h('span', { key: col, className: 'sky-month', style: { gridArea: `1 / ${col + 2}` } }, `${month}月`)),
            ['一', '三', '五'].map((label, index) => h('span', { key: label, className: 'sky-weekday', style: { gridArea: `${2 + 2 * index} / 1` } }, label)),
            dates.map((date, index) => {
              const cell = index + offset;
              const value = cells[index];
              const level = value === 0 ? 0 : Math.ceil(value * 4 / max);
              const description = `${date} · ${number(value)} ${metric === 'requests' ? '次请求' : '已知 tokens'}`;
              return h('button', { key: date, type: 'button', className: 'sky-day', 'data-level': level, 'data-date': date,
                title: description, 'aria-label': description, 'aria-pressed': selected === date,
                tabIndex: keyboardDate === date ? 0 : -1, style: { gridArea: `${cell % 7 + 2} / ${Math.floor(cell / 7) + 2}` },
                onClick: () => choose(date), onFocus: () => setFocused(date), onKeyDown: event => move(event, date) });
            }))),
        h('div', { className: 'sky-muted sky-legend', 'aria-hidden': true }, '少',
          [0, 1, 2, 3, 4].map(level => h('span', { key: level, className: 'sky-swatch', 'data-level': level })), '多'),
        h('p', { className: 'sky-muted' }, '点击日期查看当天明细，方向键切换日期。'));
    }

    const statuses = { done: '完成', aborted: '取消', error: '失败' };
    function Usage({ usage, error, onRetry, onExport }) {
      const today = dateKey(new Date());
      const [range, setRange] = React.useState({ start: dateAt(today, -6), end: today });
      const [preset, setPreset] = React.useState(7);
      const [page, setPage] = React.useState(1);
      const [exporting, setExporting] = React.useState(false);
      const [saved, setSaved] = React.useState(null);
      const [exportError, setExportError] = React.useState('');
      const previous = React.useRef(null);
      const items = usage?.rows ?? [];
      const activity = new Map();
      for (const row of items) {
        const date = dateKey(new Date(row.time));
        const day = activity.get(date) ?? { requests: 0, tokens: 0 };
        day.requests++;
        day.tokens += row.tokens ?? 0;
        activity.set(date, day);
      }
      const valid = Boolean(range.start && range.end && range.start <= range.end);
      const rows = valid ? items.filter(row => {
        const date = dateKey(new Date(row.time));
        return date >= range.start && date <= range.end;
      }) : [];
      const known = rows.reduce((sum, row) => sum + (row.tokens ?? 0), 0);
      const unknown = rows.filter(row => row.tokens == null).length;
      const selected = range.start === range.end ? range.start : null;
      const pages = Math.max(1, Math.ceil(rows.length / 20));
      const currentPage = Math.min(page, pages);
      function selectPreset(days) {
        previous.current = null;
        setPreset(days); setRange({ start: dateAt(today, 1 - days), end: today }); setPage(1);
      }
      function selectDay(date) {
        if (selected === date && previous.current) {
          setRange(previous.current.range); setPreset(previous.current.preset); previous.current = null;
        } else {
          previous.current ??= { range, preset };
          setRange({ start: date, end: date }); setPreset(null);
        }
        setPage(1);
      }
      const dateField = (key, label) => h('input', { type: 'date', 'aria-label': label, value: range[key],
        onChange: event => { previous.current = null; setRange({ ...range, [key]: event.target.value }); setPreset(null); setPage(1); } });
      async function save() {
        setExporting(true);
        setSaved(null);
        setExportError('');
        try { setSaved(await onExport(range)); }
        catch (problem) { setExportError(problem.message); }
        finally { setExporting(false); }
      }
      let details;
      if (!valid) details = '请选择有效的起止日期。';
      else if (error) details = error;
      else if (!usage) details = '正在读取本机用量…';
      else if (!rows.length) details = '这个时间段暂无用量记录';
      return h(React.Fragment, null,
        usage && h(Calendar, { activity, today, selected, choose: selectDay }),
        h('section', { className: 'sky-section', 'aria-labelledby': 'sky-detail-title' },
          h('div', { className: 'sky-flex' },
            h('div', null, h('h2', { id: 'sky-detail-title' }, '用量明细'),
              h('p', { className: 'sky-muted' }, '本机 Skymoni 插件请求 · 实际扣分以账户账单为准')),
            button(exporting ? '正在导出…' : '导出', { disabled: exporting || !rows.length, onClick: save })),
          saved && h('p', { role: 'status', className: 'sky-export-path' }, `已导出 ${number(saved.count)} 条记录到 ${saved.path}`),
          exportError && h('p', { role: 'alert', className: 'sky-error' }, exportError),
          h('div', { className: 'sky-flex' },
            h('div', { role: 'group', 'aria-label': '用量日期范围', className: 'sky-segments' },
              [[1, '今天'], [7, '7 天'], [30, '30 天']].map(([days, label]) => button(label, {
                key: days, className: undefined, 'aria-pressed': preset === days, onClick: () => selectPreset(days),
              }))),
            h('div', { className: 'sky-dates sky-muted' }, dateField('start', '用量开始日期'), '至', dateField('end', '用量结束日期'))),
          usage && valid && h('div', { className: 'sky-muted sky-summary' },
            `已记录 ${number(rows.length)} 次请求　已知用量 ${number(known)} tokens${unknown ? `　${number(unknown)} 次未报告用量` : ''}`),
          usage?.limited && h('p', { className: 'sky-muted' }, '本机保留最近 5,000 条用量记录。'),
          usage?.incomplete && h('p', { className: 'sky-error', role: 'status' }, '部分请求的用量未能写入本机。'),
          details ? h('div', { className: 'sky-box sky-empty', role: 'status' }, details, error && h('p', null, button('重新读取', { onClick: onRetry })))
            : h('div', { className: 'sky-box sky-scroll' }, h('table', null,
              h('thead', null, h('tr', null, ['时间', '模型', 'Tokens', '状态'].map(label => h('th', { key: label, scope: 'col' }, label)))),
              h('tbody', null, rows.slice((currentPage - 1) * 20, currentPage * 20).map((row, index) => h('tr', { key: index },
                h('td', null, new Date(row.time).toLocaleString('zh-CN', { hour12: false })),
                h('td', null, row.model), h('td', null, number(row.tokens)), h('td', null, statuses[row.status])))))),
          pages > 1 && h('div', { className: 'sky-flex sky-pages' }, h('span', { className: 'sky-muted' }, `第 ${currentPage} / ${pages} 页`),
            h('div', { className: 'sky-actions' },
              button('上一页', { disabled: currentPage === 1, onClick: () => setPage(currentPage - 1) }),
              button('下一页', { disabled: currentPage === pages, onClick: () => setPage(currentPage + 1) })))));
    }

    function AccountPanel({ ctx }) {
      const [state, setState] = React.useState(null);
      const [error, setError] = React.useState('');
      const [phase, setPhase] = React.useState('');
      const [usage, setUsage] = React.useState(null);
      const [usageError, setUsageError] = React.useState('');
      const revision = React.useRef(0);
      const lifetime = React.useRef(null);
      const working = React.useRef(false);
      const returning = React.useRef(false);

      React.useEffect(() => {
        const controller = new AbortController();
        lifetime.current = controller;
        call(ctx, 'state', controller.signal).then(value => {
          if (!controller.signal.aborted) setState(value);
        }).catch(() => {
          if (!controller.signal.aborted) setError('账户连接暂时不可用，请重试。');
        });
        return () => { controller.abort(); revision.current++; };
      }, [ctx]);

      const authorizing = state?.authorizing === true;
      React.useEffect(() => {
        if (!authorizing) return;
        const controller = new AbortController();
        let timer;
        async function read() {
          const previous = revision.current;
          try {
            const value = await call(ctx, 'state', controller.signal);
            if (!controller.signal.aborted && previous === revision.current && !working.current) {
              setState(value);
              setError('');
            }
          } catch {
            if (!controller.signal.aborted) setError('账户连接暂时不可用，正在重试。');
          }
          if (!controller.signal.aborted) timer = setTimeout(read, 1500);
        }
        timer = setTimeout(read, 1500);
        return () => { controller.abort(); clearTimeout(timer); };
      }, [ctx, authorizing]);

      const act = React.useCallback(async function (action) {
        if (working.current) return;
        const signal = lifetime.current?.signal;
        if (!signal || signal.aborted) return;
        working.current = true;
        revision.current++;
        setPhase(action);
        setError('');
        try {
          const value = await call(ctx, action, signal);
          if (signal.aborted) return;
          setState(value);
          if (!value.signedIn) {
            setUsage(null);
            setUsageError('');
          } else if (action === 'dashboard') {
            setUsageError('');
            try {
              const report = await call(ctx, 'usage', signal);
              if (!signal.aborted) setUsage(report);
            } catch {
              if (!signal.aborted) {
                setUsage(null);
                setUsageError('本机用量暂时无法读取。');
              }
            }
          }
        } catch (problem) {
          if (!signal.aborted) setError(problem.message);
        } finally {
          working.current = false;
          if (!signal.aborted) setPhase('');
        }
      }, [ctx]);
      const signedIn = state?.signedIn === true;
      React.useEffect(() => {
        if (signedIn) void act('dashboard');
      }, [signedIn, act]);
      React.useEffect(() => {
        if (!signedIn) return;
        function refreshOnReturn() {
          if (!returning.current || working.current) return;
          returning.current = false;
          void act('dashboard');
        }
        window.addEventListener('focus', refreshOnReturn);
        return () => window.removeEventListener('focus', refreshOnReturn);
      }, [signedIn, act]);

      const busy = Boolean(phase || state?.busy);
      const action = (label, id, className) => button(label, { disabled: busy, onClick: () => act(id), className: className ?? 'sky-button' });
      let content;
      if (authorizing) {
        const authorization = state.authorization;
        content = h('div', { className: 'sky-box sky-login' },
          h('p', null, '请在浏览器使用 skymoni.com 的签到账户确认授权。'),
          h('div', { className: 'sky-actions sky-section' },
            authorization && link('打开 Skymoni 授权页', '', { href: authorization.url, className: 'sky-button sky-primary' }),
            action('取消登录', 'cancel')));
      } else if (signedIn) {
        content = h(React.Fragment, null,
          h('div', { className: 'sky-balance sky-box sky-flex' },
            h('div', null, h('b', null, '可用积分'),
              h('div', { className: 'sky-amount' }, h('span', { className: 'sky-credit', 'aria-hidden': true }, '✧'),
                h('span', { 'aria-live': 'polite' }, state.balanceLabel)),
              h('p', { className: 'sky-muted' }, `Skymoni 账户余额${state.subscriptions?.length ? ' · 订阅额度单独列出' : ''}`),
              state.walletError && h('p', { className: 'sky-error', role: 'alert' }, state.walletError)),
            link('管理积分', '/wallet', { className: 'sky-button sky-primary', onClick: () => { returning.current = true; } })),
          h('dl', { className: 'sky-stats' },
            h('div', null, h('dt', null, '累计消耗'), h('dd', null, state.usedLabel)),
            h('div', null, h('dt', null, '累计请求'), h('dd', null, number(state.wallet?.requestCount)))),
          state.subscriptions?.length > 0 && h('section', { className: 'sky-box sky-subscriptions' },
            h('h2', null, '订阅额度'), h('p', { className: 'sky-muted' }, '剩余 / 总额度'),
            state.subscriptions.map(item => h('div', { className: 'sky-flex', key: item.id },
              h('span', null, `方案 ${item.plan}`, item.expiresAt > 0 && ` · ${new Date(item.expiresAt * 1000).toLocaleDateString('zh-CN')} 到期`),
              h('strong', null, item.label)))),
          h(Checkin, { state, phase, busy, act, returning }),
          h(Usage, { key: state.user?.id, usage, error: usageError, onRetry: () => act('dashboard'),
            onExport: range => call(ctx, 'exportUsage', lifetime.current?.signal, range) }),
          h('section', { className: 'sky-account sky-flex', 'aria-labelledby': 'sky-account-title' },
            h('div', null, h('h2', { id: 'sky-account-title' }, 'Skymoni 账户'),
              h('p', { className: 'sky-muted' }, `已登录 ${state.user?.name || 'Skymoni 账户'} · 已连接 ${state.models.length} 个模型`)),
            h('div', { className: 'sky-actions' }, action('刷新模型', 'refresh'), action('退出账户', 'logout'))));
      } else if (state) {
        content = h('div', { className: 'sky-box sky-login' },
          h('p', null, '登录 Skymoni 后可查看余额、签到，并在 DSH 中选择 Skymoni 模型。'),
          h('div', { className: 'sky-actions sky-section' }, action('使用 Skymoni 账户登录', 'login', 'sky-button sky-primary')));
      } else if (!error) {
        content = h('p', { role: 'status' }, '正在连接…');
      }

      return h('section', { 'aria-labelledby': 'skymoni-account-title', className: 'skymoni-panel' },
        h('style', null, STYLES),
        h('div', { className: 'sky-body' },
          h('header', { className: 'sky-header' },
            h('h1', { id: 'skymoni-account-title' }, '用量管理'),
            signedIn && h('div', { className: 'sky-actions' }, action(phase === 'dashboard' ? '正在刷新…' : '刷新', 'dashboard'))),
          (error || state?.error) && h('p', { role: 'alert', className: 'sky-error' }, error || state.error.message),
          content,
          error && !state && action('重新连接', 'state')));
    }

    return {
      inject: ['connection', 'slots'],
      apply(ctx) {
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL }, () => h(AccountPanel, { ctx })));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL, order: -10, label: TITLE,
        }, Avatar));
      },
    };
  },
});
