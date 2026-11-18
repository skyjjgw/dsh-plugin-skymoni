export const ORIGIN = 'https://skymoni.com';
export const PROVIDER = 'skymoni-account';
export const RPC = 'skymoni-account/';
export const ERRORS = Object.freeze({
  SIGNED_OUT: '请先登录小云账户。', AUTHORIZATION_PENDING: '等待你在网站确认授权。',
  SLOW_DOWN: '正在等待授权，请稍候。', EXPIRED_TOKEN: '授权已过期，请重新登录。',
  ACCESS_DENIED: '授权被拒绝，请重新登录。', APP_SESSION_INVALID: '登录已失效，请重新登录。',
  NETWORK: '暂时无法连接小云，请稍后重试。', PROTOCOL: '服务返回的数据无法识别，请稍后重试。',
  STORAGE: '无法保存账户凭据，请检查 DSH 凭据存储后重试。',
  CANCELLED: '操作已取消。', DISPOSED: '插件已关闭。', STALE: '账户已经切换，请重新发起任务。',
  SKIVU_API_KEY_UNAVAILABLE: '本站 API Key 已停用或过期，请在网站令牌管理中检查。',
  SKIVU_API_KEY_LIMIT: '本站令牌数量已达上限，请在网站令牌管理中检查。',
  REMOTE_LOGOUT: '本地已退出，远程注销尚未确认，可在网站会话管理中撤销此设备。',
  AUTH_SESSION_LIMIT: '账户会话数量已达上限，请先在网站管理会话。',
  AUTH_ISSUANCE_LIMIT: '授权过于频繁，请稍后重试。', APP_SERVICE_UNAVAILABLE: '账户服务暂时不可用。',
});
export function fail(code) {
  const error = new Error(ERRORS[code] || ERRORS.APP_SERVICE_UNAVAILABLE);
  error.code = Object.hasOwn(ERRORS, code) ? code : 'APP_SERVICE_UNAVAILABLE';
  return error;
}
export function publicError(error) {
  const code = Object.hasOwn(ERRORS, error?.code) ? error.code : 'APP_SERVICE_UNAVAILABLE';
  return { code, message: ERRORS[code] };
}
export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function integer(value, min, max) {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(number) || number < min || number > max) throw fail('PROTOCOL');
  return number;
}
export function parseJSON(source) {
  return JSON.parse(source, (_key, value, context) => typeof value === 'number' && !Number.isSafeInteger(value) ? context.source : value);
}
export function authorizationURL(value, code) {
  try {
    const url = new URL(value), entries = [...url.searchParams];
    if (url.origin !== ORIGIN || url.username || url.password || url.pathname !== '/app/authorize' || url.hash ||
      entries.length !== 1 || entries[0][0] !== 'code' || entries[0][1] !== code || !/^[A-Za-z0-9_-]{1,64}$/.test(code)) throw Error();
    return url.href;
  } catch { throw fail('PROTOCOL'); }
}
function numeric(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  if (typeof value === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) && value.length <= 100) return value;
  throw fail('PROTOCOL');
}
export function profile(data) {
  if (!object(data?.user) || !object(data.wallet)) throw fail('PROTOCOL');
  const string = value => typeof value === 'string' && value.length <= 256 ? value : '';
  return {
    user: { id: numeric(data.user.id), name: string(data.user.display_name) || string(data.user.username), group: string(data.user.group) },
    wallet: { balance: numeric(data.wallet.balance), used: numeric(data.wallet.used ?? 0), requestCount: numeric(data.wallet.request_count ?? 0) },
    quotaPerUnit: numeric(data.quota_per_unit), currency: string(data.currency),
    session: { id: string(data.session?.id), deviceName: string(data.session?.device_name) },
    subscriptionCount: Array.isArray(data.subscriptions) ? data.subscriptions.length : 0,
  };
}
export function models(data) {
  if (!Array.isArray(data?.models) || data.models.length > 10000 || !object(data.model_protocols)) throw fail('PROTOCOL');
  return [...new Set(data.models)].filter(id => typeof id === 'string' && id.length > 0 && id.length <= 256 &&
    ['chat', 'responses'].includes(data.model_protocols[id])).map(id => ({ id, protocol: data.model_protocols[id] }));
}
export function formatCredits(quota, unit, currency = 'USD') {
  try {
    if (!/^-?\d{1,100}$/.test(String(quota)) || !/^\d{1,100}(?:\.\d{1,20})?$/.test(String(unit))) return '—';
    const [whole, fraction = ''] = String(unit).split('.');
    const divisor = BigInt(whole + fraction); if (divisor <= 0n) return '—';
    const amount = BigInt(quota), negative = amount < 0n;
    const scaled = (negative ? -amount : amount) * 10n ** BigInt(4 + fraction.length);
    const rounded = scaled / divisor + ((scaled % divisor) * 2n >= divisor ? 1n : 0n);
    return `${negative && rounded ? '-' : ''}${rounded / 10000n}.${String(rounded % 10000n).padStart(4, '0')} ${currency === 'USD' ? '积分' : currency}`;
  } catch { return '—'; }
}
