# WebTestAI クイックリファレンス

## 🚀 基本コマンド

### インストール・初期設定
```bash
# 初期設定（依存関係インストール含む）
./init.sh

# AI CLI切り替え
./web-test switch          # 利用可能なCLI表示
./web-test switch gemini   # Gemini CLIに切り替え
./web-test switch claude   # Claude CLIに切り替え
```

### テストケース生成

#### 🤖 AI自動生成（包括的テスト）
```bash
# 対話型実行（v2.1新機能）
./web-test auto
# → base_url/admin_url/カスタムURLを選択
# → セッション維持オプション（ログイン状態保持）

# URL直接指定
./web-test auto --url https://example.com

# オプション付き
./web-test auto --url https://example.com --cli gemini
./web-test auto --url https://example.com --headless
```

#### 🎬 録画
```bash
# 対話式録画
./web-test record

# URL指定録画
./web-test record --url https://example.com

# 終了方法：ブラウザを閉じるかCtrl+C
```

#### ▶️ 再生
```bash
# 録画一覧表示
./web-test play --list

# 特定ファイル再生
./web-test play --file recording-2024-01-01.json

# 再生後テストケース生成
./web-test play --file recording.json --auto-generate
```

### テスト実行
```bash
# ファイル選択して実行（対話式）
./web-test run

# 特定ファイル指定
./web-test run --test-file test-cases-backup-2024.json

# プロンプトスキップ（デフォルトファイル使用）
./web-test run --no-prompt
```

### テストケース管理
```bash
# 一覧表示
./web-test cases --list

# 特定のケース削除
./web-test cases --delete TC001

# エクスポート
./web-test cases --export
```

## 📝 オプション一覧

### `auto` コマンド
| オプション | 説明 |
|-----------|------|
| `--url <URL>` | テスト対象URL（必須） |
| `--cli <gemini\|claude>` | 使用するAI CLI |
| `--headless` | ヘッドレスモード |

### `record` コマンド
| オプション | 説明 |
|-----------|------|
| `--url <URL>` | 録画開始URL |

### `play` コマンド
| オプション | 説明 |
|-----------|------|
| `--list` | 録画ファイル一覧 |
| `--file <filename>` | 再生するファイル |
| `--auto-generate` | テストケース生成 |

### `run` コマンド
| オプション | 説明 |
|-----------|------|
| `--test-file <filename>` | 使用するテストファイル |
| `--no-prompt` | プロンプトをスキップ |

## 🔒 セキュリティテスト

自動生成される攻撃パターン：

### XSS（8種類）
```javascript
<script>alert('XSS')</script>
<img src=x onerror=alert('XSS')>
javascript:alert('XSS')
// 他5種類
```

### SQLインジェクション（7種類）
```sql
' OR '1'='1
1; DROP TABLE users--
admin'--
// 他4種類
```

### その他
- ディレクトリトラバーサル（3種類）
- CSRF（2種類）

### 実行手順（自動化）
- 各ペイロードは1つのテストケース内で以下を実行します：
  1) アクセス（goto）→ 2) フィールド待機（wait_for_selector）→ 3) クリア（clear）→ 4) 入力（fill）→ 5) 送信（click）→ 6) 待機（wait）→ 7) ダイアログ未発火確認（check_alert）
- Runnerは`page.on('dialog')`でalert/confirm/promptの発火を検出し、発火時はFail扱いします

## 🧰 実行アクション拡張

| アクション | 説明 |
|-----------|------|
| `wait_for_navigation` | 指定URLまたは任意の遷移を待機 |
| `wait_for_selector` | 指定セレクタの出現を待機 |
| `clear` | 入力フィールドの内容をクリア（全選択→Backspace） |
| `check_alert` | ダイアログ未発火を検査（XSS等） |

## ⚙️ クリック安定化（safeClick）
- サブメニュー: 親`li`にhoverして可視化→クリック
- スライダー(slick/swiper): 可視スライド内`a[href]`を優先クリック。必要に応じてドラッグして可視化
- フォールバック: 子孫/祖先`a`、テキスト一致、`href`直接遷移

## 📂 ファイル構成

```
config/
├── test-cases.json              # 現在のテストケース
├── test-cases-backup-*.json     # バックアップ（自動生成）
└── settings.json                # 設定ファイル

recordings/
├── recording-*.json             # 録画データ
└── *.webm                      # 動画ファイル（再生不可）

src/
├── test-runner.js              # テスト実行
├── test-case-auto-generator.js # AI生成
├── comprehensive-test-generator.js # 包括的生成
├── ai-test-prompts.js          # AIプロンプト
└── test-case-recorder.js       # 録画・再生
```

## ⚡ ショートカット

```bash
# 最速でテスト生成・実行
./web-test auto --url https://example.com && ./web-test run --no-prompt

# 録画して即テスト生成
./web-test record --url https://example.com
# (操作後、ブラウザを閉じる)
./web-test play --file recording-*.json --auto-generate

# Gemini CLIでヘッドレステスト
./web-test switch gemini && ./web-test auto --url https://example.com --headless
```

## 🔧 トラブルシューティング

| 問題 | 解決方法 |
|------|---------|
| Playwright依存関係エラー | `sudo npx playwright install-deps` |
| 録画ファイル再生エラー | .jsonファイルのみ対応 |
| オートコンプリート干渉 | v2.0で自動無効化済み |
| テストケース上書き | `config/test-cases-backup-*.json`から復元 |
| 日本語文字化け | `sudo apt install fonts-noto-cjk` |

## 🎯 v2.1 新機能

### 最新機能（v2.1）
- **URL選択機能**: base_url/admin_urlから選択可能
- **セッション維持**: ログイン状態を保持したテスト生成
- **認証ページ対応**: 管理画面等のテストケース生成
- **改善された入力処理**: パスワード入力の確実性向上

### v2.0機能
- **包括的テスト生成**: 最大50個のテストケース自動生成
- **セキュリティテスト**: XSS、SQLインジェクション等の自動検出
- **ファイル管理**: バックアップ自動作成、ファイル選択機能
- **オートコンプリート対策**: ブラウザ自動入力の無効化
- **座標順解析**: 上→下、左→右の体系的な要素解析
