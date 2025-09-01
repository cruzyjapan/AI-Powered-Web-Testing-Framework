import ConfigManager from '../config-manager.js';
import CLIManager from '../cli-manager.js';

// ルールベース + AI CLI（任意）で、プレースホルダーや周辺テキストからダミーデータを推定
export default class DataInference {
  constructor(config) {
    this.config = config || new ConfigManager().config;
    this.cliManager = new CLIManager(this.config);
  }

  // 公開API: フィールド情報から値を推定
  async inferValue(field, options = {}) {
    // 1) ルールベースで即時推定
    const ruleValue = this.ruleBasedValue(field);
    if (ruleValue) return ruleValue;

    // 2) AI CLIが利用可能なら、追加の文脈を使って推定
    const defaultCli = (this.config.ai_cli_settings?.default_cli || 'auto');
    const canUseCli = this.cliManager && this.cliManager.isAvailable(defaultCli);
    if (options.allowAI !== false && canUseCli) {
      try {
        const prompt = this.buildPrompt(field);
        const cli = (this.config.ai_cli_settings?.default_cli || 'auto');
        const res = await this.cliManager.execute(cli, prompt, { format: 'json' });
        // 期待フォーマット: { value: string, reason?: string }
        if (res && typeof res === 'object') {
          const v = res.value || res.suggestion || res.example;
          if (v) return String(v);
        }
        if (typeof res === 'string' && res.trim()) {
          const s = res.trim();
          try {
            const obj = JSON.parse(s);
            if (obj && (obj.value || obj.suggestion || obj.example)) {
              return String(obj.value || obj.suggestion || obj.example);
            }
          } catch (_) {}
          return s;
        }
      } catch (_) {
        // 失敗時はフォールバック
      }
    }

    // 3) 最終フォールバック
    return this.defaultValue(field);
  }

  // ルールベース推定
  ruleBasedValue(field) {
    const t = (field.type || '').toLowerCase();
    const name = (field.name || '').toLowerCase();
    const id = (field.id || '').toLowerCase();
    const ph = (field.placeholder || '').toLowerCase();
    const label = (field.label || '').toLowerCase();
    const ctx = [ph, label, (field.beforeText || '').toLowerCase(), (field.afterText || '').toLowerCase()].join(' ');

    const has = (kw) => ctx.includes(kw) || name.includes(kw) || id.includes(kw);

    // メール
    if (t === 'email' || has('email') || has('メール')) return `test+${Date.now()}@example.com`;
    // パスワード
    if (t === 'password' || has('パスワード')) return 'SecureP@ss123!';
    // 電話
    if (t === 'tel' || has('電話') || has('tel')) return '090-1234-5678';
    // 郵便番号
    if (has('郵便') || has('郵便番号') || name.includes('zip') || name.includes('postal')) return '150-0001';
    // 都道府県/県
    if (has('都道府県') || has('県')) return '東京都';
    // 住所
    if (has('住所') || name.includes('addr') || name.includes('address')) return '東京都渋谷区神南1-2-3';
    // 氏名/名前
    if (has('氏名') || has('お名前') || has('名前') || has('name')) return '山田太郎';
    // フリガナ/カナ
    if (has('フリガナ') || has('カナ') || name.includes('kana')) return 'ヤマダ タロウ';
    // 会社/企業/法人
    if (has('会社') || has('企業') || has('法人') || name.includes('company')) return '株式会社テスト';
    // 数量/個数
    if (has('数量') || has('個数') || name.includes('qty') || name.includes('quantity')) return '2';
    // 金額/価格
    if (has('金額') || has('価格') || has('金') || name.includes('price') || name.includes('amount')) return '1000';
    // 日付
    if (t === 'date' || has('日付') || name.includes('date')) return new Date().toISOString().slice(0,10);
    // URL
    if (t === 'url' || has('url') || has('サイト')) return 'https://example.com';
    // 検索/キーワード
    if (t === 'search' || has('検索') || has('キーワード')) return '山田太郎';
    // メッセージ/問い合わせ
    if (has('メッセージ') || has('お問い合わせ') || has('問い合わせ') || name.includes('message')) return 'お問い合わせのテストメッセージです。';

    // 数値タイプ
    if (t === 'number') return '1';

    // 既定テキスト
    if (t === 'text' || t === 'search' || !t) return field.example || 'テスト入力';

    return null;
  }

  // フォールバック既定値
  defaultValue(field) {
    if ((field.type || '').toLowerCase() === 'number') return '1';
    return 'テスト入力';
  }

  // AI CLI向けのプロンプト構築（簡潔なJSON返却を促す）
  buildPrompt(field) {
    const lines = [];
    lines.push('あなたは日本語Webフォームの入力補助AIです。');
    lines.push('以下のフィールド情報から、最も自然で妥当なダミー値を1つだけ返してください。');
    lines.push('必ずJSONのみで出力し、キーは "value" と "reason"（理由は簡潔）。');
    lines.push('考慮: プレースホルダー、ラベル、前後の文、型、name/id、必須、maxlength、pattern、日本語の文脈。');
    lines.push('例: {"value":"山田太郎","reason":"名前項目のため"}');
    lines.push('--- フィールド情報 ---');
    lines.push(JSON.stringify({
      pageUrl: field.pageUrl,
      pageTitle: field.pageTitle,
      type: field.type,
      name: field.name,
      id: field.id,
      placeholder: field.placeholder,
      label: field.label,
      ariaLabel: field.ariaLabel,
      beforeText: field.beforeText,
      afterText: field.afterText,
      required: field.required,
      maxLength: field.maxLength,
      pattern: field.pattern
    }));
    return lines.join('\n');
  }
}
