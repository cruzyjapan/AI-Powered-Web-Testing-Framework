# WebTestAI ヘルプドキュメント

## 📚 目次

1. [はじめに](#はじめに)
2. [基本コマンド](#基本コマンド)
3. [詳細な使い方](#詳細な使い方)
4. [トラブルシューティング](#トラブルシューティング)
5. [FAQ](#faq)

## はじめに

WebTestAIは、AI CLIを活用してWebアプリケーションのテストを自動化するフレームワークです。

### 基本的なワークフロー

1. **初期設定** → `./init.sh`
2. **AI CLI選択** → `./web-test switch`
3. **テストケース生成** → `./web-test auto-generate` または `./web-test generate`
4. **テスト実行** → `./web-test run`
5. **レポート確認** → `reports/` ディレクトリ

## 基本コマンド

### `./web-test --help`
すべての利用可能なコマンドとオプションを表示します。

### `./web-test auto-generate [options]`
AIがページを解析してテストケースを自動生成します。

**オプション:**
- `--url <URL>` - テスト対象のURL
- `--cli <CLI>` - 使用するAI CLI（gemini/claude）
- `--headless` - ヘッドレスモードで実行

**例:**
```bash
./web-test auto-generate --url https://example.com --cli gemini
```

### `./web-test generate [options]`
Playwrightの録画機能を使ってテストケースを作成します。

**オプション:**
- `--url <URL>` - 開始URL
- `--name <name>` - テストケース名
- `--headless` - ヘッドレスモード

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
- `GEMINI` - Gemini CLI
- `CLAUDE` - Claude CLI
- `AUTO` - 自動選択

### `./web-test cases [options]`
テストケースを管理します。

**オプション:**
- `--list` - 一覧表示
- `--delete <ID>` - テストケース削除
- `--edit <ID>` - テストケース編集

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

### AI CLIが応答しない

**症状:** タイムアウトエラーが発生する

**解決方法:**
1. AI CLIが正しくインストールされているか確認
   ```bash
   which gemini
   which claude
   ```

2. AI CLIの認証を確認
   ```bash
   gemini --help
   claude --help
   ```

3. タイムアウト設定を延長（config/settings.json）
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

## FAQ

### Q: Gemini CLIとClaude CLIどちらを使うべき？
A: 両方試して、プロジェクトに適した方を選択してください。
- **Gemini CLI** - 高速、シンプルな応答
- **Claude CLI** - 詳細な分析、複雑なテストケース

### Q: テストケースは手動で編集できる？
A: はい、`config/test-cases.json`を直接編集するか、`./web-test cases --edit`コマンドを使用してください。

### Q: ヘッドレスモードとは？
A: ブラウザを表示せずにバックグラウンドで実行するモードです。CI/CD環境やサーバーでの実行に適しています。

### Q: 並列実行は可能？
A: 現在は順次実行のみサポートしています。将来的に並列実行機能を追加予定です。

### Q: カスタムアサーションの追加方法は？
A: `src/test-runner.js`のアサーション処理部分を拡張してください。

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
    "timeout": 30000
  }
}
```

## サポート

問題が解決しない場合は、GitHubのIssuesで報告してください。
- デバッグログを添付
- エラーメッセージの全文
- 実行環境の情報（OS、Node.jsバージョンなど）