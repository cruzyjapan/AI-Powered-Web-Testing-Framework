# WebTestAI ヘルプドキュメント

## 📚 目次

1. [はじめに](#はじめに)
2. [基本コマンド](#基本コマンド)
3. [詳細な使い方](#詳細な使い方)
4. [トラブルシューティング](#トラブルシューティング)
5. [FAQ](#faq)

## はじめに

WebTestAIは、AI CLIを活用してWebアプリケーションのテストを自動化するフレームワークです。

### 基本的なワークフロー（2025-09 更新）

1. **初期設定** → `./init.sh`
2. **AI CLI選択** → `./web-test switch`
3. **テストケース生成** → `./web-test auto-generate` または `./web-test generate`
   - セキュリティ: XSS/SQLは単一ケース内で「入力→送信→未発火確認」まで実行
   - 入力値推論: placeholder/前後文脈からダミー値を自動生成（CLI/ルール）
   - ステップ補完: リンク/セレクト/検索は不足時に「アクセス→操作→遷移待機」を自動合成
   - クリック安定化: safeClickによりサブメニュー/スライダーも確実にクリック・遷移
4. **テスト実行** → `./web-test run`
5. **レポート確認** → `reports/` ディレクトリ

## 基本コマンド

### `./web-test --help`
すべての利用可能なコマンドとオプションを表示します。

### `./web-test auto-generate [URL]`
AIがページを解析してテストケースを自動生成します。

**オプション:**
- `--url <URL>` - テスト対象のURL
- `--cli <CLI>` - 使用するAI CLI（gemini/claude/auto）
- `--headless` - ヘッドレスモードで実行

**注意:** URLを指定しない場合、対話式モードでURL入力を求められます。生成時に不足手順は自動補完されます。

**実際の使用例:**
```bash
# 最も簡単な使い方（URLを直接指定）
./web-test auto-generate http://localhost:4009/

# --urlオプションを使用
./web-test auto-generate --url http://localhost:3000

# Gemini CLIを指定して生成
./web-test auto --url http://localhost:8080 --cli gemini

# Claude CLIを指定
./web-test auto --url https://example.com --cli claude
```

**実行結果の例:**
```
🤖 AI駆動ページ解析開始
✔ ページ解析完了
🧠 AI CLIでテストケースを生成中...
✅ 10個のテストケースを生成しました
📝 保存完了: TC001, TC002, TC003, TC004, TC005...
```

### `./web-test generate [options]`
Playwrightの録画機能を使ってテストケースを作成します。

**オプション:**
- `--url <URL>` - 開始URL
- `--name <name>` - テストケース名
- `--edit <test_id>` - 既存テストケースを編集
- `--headless` - ヘッドレスモード

**カスタムURL:** 対話モードではデフォルトURLをオーバーライド可能

**新ロジック（録画）:**
- クリックはsafeClickで安定化（サブメニュー・スライダー・祖先/子孫a・href直接遷移）
- ステップは不足時に合成（アクセス→操作→遷移待機）

### `./web-test run [options]`
テストケースを実行します。

**オプション:**
- `--cli <CLI>` - AI CLI選択
- `--cases <IDs>` - 実行するテストケースID（カンマ区切り）
- `--category <name>` - カテゴリ別実行
- `--format <format>` - 出力形式（csv,excel,html）

### `./web-test switch [CLI]`
デフォルトのAI CLIを切り替えます。

**利用可能なCLI:**
- `gemini` - Gemini CLI
- `claude` - Claude CLI
- `auto` - 自動選択

### `./web-test cases [options]`
テストケースを管理します。

**オプション:**
- `--list` - 一覧表示
- `--delete <ID>` - テストケース削除
- `--export` - テストケースをエクスポート

### `./web-test export [options]`
テストケースをエクスポートします。

**オプション:**
- `--format <type>` - 出力形式（json/csv/markdown）
- `--encoding <type>` - エンコーディング（shift_jis/utf8/utf8_bom）

**例:**
```bash
# Shift-JISでCSVエクスポート（日本企業向け）
./web-test export --format csv --encoding shift_jis
```

### `./web-test config`
対話型の設定画面を開きます。

## 詳細な使い方

### AI自動生成モード

1. **URLだけで生成**
   ```bash
   ./web-test auto --url https://example.com
   ```
   AIがページを解析し、以下を自動生成：
   - 正常系テスト
   - 異常系テスト
   - セキュリティテスト

2. **特定のAI CLIを使用**
   ```bash
   ./web-test auto --url https://example.com --cli claude
   ```

### 録画モード

1. **対話式録画**
   ```bash
   ./web-test generate
   ```
   - URLを入力
   - ブラウザでテスト操作を実行
   - Ctrl+Cで終了

2. **即座に録画開始**
   ```bash
   ./web-test generate --url https://example.com --name "購入フロー"
   ```

### テスト実行

1. **全テスト実行**
   ```bash
   ./web-test run
   ```

2. **特定テストのみ**
   ```bash
   ./web-test run --cases TC001,TC002,TC003
   ```

3. **カテゴリ別実行**
   ```bash
   ./web-test run --category "ログイン機能"
   ```

## トラブルシューティング

### Playwright依存関係エラー

**症状:** `sudo npx playwright install-deps` の実行を求められる

**解決方法:**
```bash
# 必要なシステムライブラリをインストール
sudo apt-get update
sudo apt-get install -y libnspr4 libnss3 libasound2t64

# またはPlaywrightの推奨コマンド
sudo npx playwright install-deps
```

### AI CLIが応答しない / 「ずっと実行中」になる

**症状:** Gemini/Claude実行時にタイムアウトエラーが発生する

**解決方法:**
1. **v1.2.0で修正済み** - 自動リトライ機能が追加されました
   - 5分ごとに自動再試行
   - 最大1時間まで自動延長

2. AI CLIが正しくインストールされているか確認
   ```bash
   which gemini
   which claude
   ```

3. AI CLIの認証を確認
   ```bash
   gemini --help
   claude --help
   ```

4. タイムアウト設定を確認（config/settings.json）
   ```json
   "max_timeout": 3600
   ```

### テストが失敗する

**症状:** アサーションエラーが発生

**解決方法:**
1. セレクタが正しいか確認
2. ページの読み込みを待機する設定を追加
3. `headless: false`でデバッグ実行

### レポートが生成されない

**症状:** reportsディレクトリが空

**解決方法:**
1. 書き込み権限を確認
   ```bash
   chmod -R 755 reports/
   ```

2. Node.jsのバージョンを確認
   ```bash
   node --version  # v18以上が必要
   ```

### Windows 11で文字化けする / CSVエクスポートの文字化け

**症状:** 
- Playwrightのブラウザで日本語が□□□と表示される
- CSV/Excelエクスポートで日本語が文字化けする

**解決方法:**

1. **エクスポートの文字化け** - Shift-JISエンコーディングを使用
   ```bash
   ./web-test export --format csv --encoding shift_jis
   ```

2. **ブラウザの文字化け** - システムロケールをUTF-8に設定
   ```
   設定 → 時刻と言語 → 言語と地域 → 管理用の言語の設定 → 
   「ベータ: ワールドワイド言語サポートでUnicode UTF-8を使用」にチェック
   ```

3. **WSL2を使用（推奨）**
   ```bash
   # 日本語フォントをインストール
   sudo apt install -y fonts-noto-cjk
   ```

詳細は [WINDOWS_SETUP.md](WINDOWS_SETUP.md) を参照してください。

## FAQ

### Q: Gemini CLIとClaude CLIどちらを使うべき？
A: 両方試して、プロジェクトに適した方を選択してください。
- **Gemini CLI** - 高速、シンプルな応答
- **Claude CLI** - 詳細な分析、複雑なテストケース
- **auto** - 利用可能なCLIを自動選択

### Q: テストケースは手動で編集できる？
A: はい、`config/test-cases.json`を直接編集するか、`./web-test cases --edit`コマンドを使用してください。

### Q: ヘッドレスモードとは？
A: ブラウザを表示せずにバックグラウンドで実行するモードです。CI/CD環境やサーバーでの実行に適しています。

### Q: 並列実行は可能？
A: 現在は順次実行のみサポートしています。将来的に並列実行機能を追加予定です。

### Q: カスタムアサーションの追加方法は？
A: `src/test-runner.js`のアサーション処理部分を拡張してください。

### Q: URLが指定したものと違うページにアクセスする
A: v1.2.0で修正済み。対話モードでカスタムURLを入力するか、`--url`オプションを使用してください。

### Q: CSVエクスポートに不要な記号が含まれる
A: v1.2.0でアスタリスク(*)の自動削除機能を追加。すべてのCSV/Excel出力で自動的にクリーンアップされます。

## 設定ファイルの詳細

### config/settings.json

```json
{
  "ai_cli_settings": {
    "gemini": {
      "enabled": true,
      "model": "gemini-2.5-pro",
      "max_timeout": 3600
    },
    "claude": {
      "enabled": true,
      "model": "claude-sonnet-4",
      "max_timeout": 3600
    }
  },
  "test_options": {
    "headless": false,
    "screenshot_enabled": true,
    "trace_enabled": false,
    "timeout": 30000,
    "locale": "ja-JP",
    "timezoneId": "Asia/Tokyo"
  },
  "encoding": {
    "primary": "shift_jis",
    "secondary": "utf8"
  }
}
```

### 重要な設定項目

- **max_timeout**: AI CLIの最大実行時間（秒）
- **locale/timezoneId**: 日本語環境設定
- **encoding**: CSV/Excel出力のエンコーディング設定
  - shift_jis: 日本企業環境向け
  - utf8: 国際標準
  - utf8_bom: Excel互換性向上

## サポート

問題が解決しない場合は、GitHubのIssuesで報告してください。
- デバッグログを添付
- エラーメッセージの全文
- 実行環境の情報（OS、Node.jsバージョンなど）
#### セキュリティテスト（一体型）
XSS/SQLは各ペイロードごとに1テストケース内で以下を実行します。

1. ページにアクセス
2. 対象フィールドの表示を待機（wait_for_selector）
3. フィールドクリア（clear）
4. ペイロード入力（fill）
5. 送信ボタンクリック（click）
6. 結果待機（wait）
7. ダイアログ未発火確認（check_alert）

実行時はRunnerが`page.on('dialog')`でalert/confirm/prompt発火を監視し、発火時は失敗とします。
