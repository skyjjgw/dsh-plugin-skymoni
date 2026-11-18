window.__ModuleLoader__.load({
  id: 'dsh-plugin-skymoni',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const PANEL = 'skymoni-account';
    const TITLE = 'Skymoni 账户登录';
    const buttonStyle = {
      border: '1px solid var(--dsw-alias-border-l2, #9996)', borderRadius: 8,
      padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-1, transparent)',
      color: 'inherit', font: 'inherit', cursor: 'pointer',
    };

    function Avatar({ size = 18 }) {
      const shape = { position: 'absolute', left: '50%', transform: 'translateX(-50%)', background: 'currentColor' };
      return h('span', { 'aria-hidden': true, style: {
        display: 'inline-block', position: 'relative', boxSizing: 'border-box', width: size, height: size,
        border: '1.2px solid currentColor', borderRadius: '50%', flexShrink: 0,
      } },
      h('span', { style: { ...shape, top: '19%', width: '29%', height: '29%', borderRadius: '50%' } }),
      h('span', { style: { ...shape, top: '55%', width: '54%', height: '23%', borderRadius: '50% 50% 25% 25%' } }));
    }

    async function call(ctx, action, signal) {
      const result = await ctx.connection.rpc.call('/api', `skymoni-account/${action}`, {}, signal);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    }

    function AccountPanel({ ctx }) {
      const [state, setState] = React.useState(null);
      const [error, setError] = React.useState('');
      const [pending, setPending] = React.useState(false);
      const revision = React.useRef(0);
      const lifetime = React.useRef(null);
      const working = React.useRef(false);

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

      async function act(action) {
        if (working.current) return;
        const signal = lifetime.current?.signal;
        if (!signal || signal.aborted) return;
        working.current = true;
        revision.current++;
        setPending(true);
        setError('');
        try {
          const value = await call(ctx, action, signal);
          if (!signal.aborted) setState(value);
        } catch (problem) {
          if (!signal.aborted) setError(problem.message);
        } finally {
          working.current = false;
          if (!signal.aborted) setPending(false);
        }
      }

      const busy = pending || state?.busy;
      const action = (label, id) => h('button', { type: 'button', disabled: busy, onClick: () => act(id), style: buttonStyle }, label);
      let content;
      if (authorizing) {
        const authorization = state.authorization;
        content = h(React.Fragment, null,
          h('p', null, '请在浏览器使用 skymoni.com 的签到账户确认授权。'),
          authorization && h('a', { href: authorization.url, target: '_blank', rel: 'noopener noreferrer', style: {
            ...buttonStyle, display: 'inline-block', textDecoration: 'none', marginRight: 8,
          } }, '打开 Skymoni 授权页'),
          action('取消登录', 'cancel'));
      } else if (state?.signedIn) {
        content = h(React.Fragment, null,
          h('p', { role: 'status' }, `已登录 ${state.user?.name || 'Skymoni 账户'}`),
          h('p', null, state.models.length
            ? `已连接 ${state.models.length} 个模型。在会话输入框的模型选择器里选择 Skymoni。`
            : '当前令牌没有可用的对话模型。'),
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
            action('刷新模型', 'refresh'), action('退出 Skymoni 账户', 'logout')));
      } else if (state) {
        content = h(React.Fragment, null, h('p', null, '使用 skymoni.com 的签到账户授权后，即可在 DSH 选择模型。'), action('使用 Skymoni 账户登录', 'login'));
      } else if (!error) {
        content = h('p', { role: 'status' }, '正在连接…');
      }

      return h('section', { 'aria-labelledby': 'skymoni-account-title', style: {
        boxSizing: 'border-box', height: '100%', overflowY: 'auto', padding: '32px clamp(20px, 5vw, 48px)',
      } },
      h('h1', { id: 'skymoni-account-title', style: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, fontWeight: 600, marginTop: 0 } },
        h(Avatar, { size: 24 }), TITLE),
      content,
      (error || state?.error) && h('p', { role: 'alert', style: { color: 'var(--dsw-alias-text-danger, #b45523)' } }, error || state.error.message),
      error && !state && action('重新连接', 'state'));
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
