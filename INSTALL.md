# 🚀 WebTestAI インストールガイド

## 📋 クイックインストール（推奨）

### 方法1: 自動セットアップスクリプト

```bash
# 1. プロジェクトディレクトリに移動
cd AI-Powered-Web-Testing-Framework/

# 2. セットアップスクリプトを実行
chmod +x setup-webtestai.sh
./setup-webtestai.sh

# 3. 画面の指示に従って設定
```

### 方法2: 手動セットアップ

```bash
# 1. 実行権限を付与
chmod +x init.sh web-test

# 2. 初期化スクリプトを実行
./init.sh

# 3. 動作確認
./scripts/health-check.sh
```

## 🔧 前提条件

### 必須要件

- **OS**: Ubuntu 20.04 LTS以降 または WSL2
- **Node.js**: v18以降
- **npm**: v8以降

### Node.jsのインストール

```bash
# Node.js v18のインストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# バージョン確認
node --version  # v18.0.0以降
npm --version   # v8.0.0以降
```

### システムパッケージのインストール

```bash
# 基本ツール
sudo apt-get update
sudo apt-get install -y curl wget git

# Playwright用依存関係（オプション）
sudo npx playwright install-deps
```

## 📁 ファイル構成

インストール後、以下の構成になります：

```
AI-Powered-Web-Testing-Framework/
├── init.sh                  # 初期化スクリプト
├── setup-webtestai.sh       # セットアップスクリプト
├── web-test                 # メインコマンド
├── package.json            # Node.js設定
├── node_modules/           # 依存パッケージ
├── config/
│   ├── settings.json       # メイン設定
│   └── test-cases.json     # テストケース
├── src/                    # ソースコード
│   ├── cli-manager.js      # AI CLI管理
│   ├── test-runner.js      # テスト実行
│   └── ...
├── scripts/
│   └── health-check.sh     # ヘルスチェック
├── tests/                  # テストファイル
├── reports/                # レポート出力
├── screenshots/            # スクリーンショット
└── logs/                   # ログファイル
```

## ✅ インストール確認

### 1. ヘルスチェック

```bash
./scripts/health-check.sh
```

正常な出力：
```
🔍 システムヘルスチェック
========================
Node.js: ✅ v22.17.0
npm: ✅ 10.9.2
Gemini CLI: ⚠️  未インストール（オプション）
Claude Code CLI: ⚠️  未インストール（オプション）
Playwright: ✅ Version 1.55.0

📁 ディレクトリ構造:
  ✅ config/
  ✅ src/
  ✅ scripts/
  ✅ tests/
  ✅ reports/
  ✅ docs/
  ✅ screenshots/

📄 設定ファイル:
  ✅ config/settings.json
  ✅ config/test-cases.json

✅ ヘルスチェック完了
```

### 2. コマンド動作確認

```bash
# ヘルプ表示
./web-test --help

# バージョン確認
./web-test --version

# 設定画面
./web-test config
```

## 🐛 トラブルシューティング

### エラー: Node.jsバージョンが古い

```bash
# Node.jsをアップグレード
sudo npm install -g n
sudo n latest
hash -r
node --version
```

### エラー: Permission denied

```bash
# 実行権限を付与
chmod +x init.sh web-test
chmod +x scripts/*.sh
```

### エラー: npm install失敗

```bash
# キャッシュクリアして再インストール
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### エラー: Playwright関連

```bash
# Playwright再インストール
npm uninstall playwright @playwright/test
npm install playwright @playwright/test
npx playwright install
sudo npx playwright install-deps
```

## 📝 初期設定

### 1. AI CLI設定（オプション）

```bash
# Gemini CLIのインストール（別途必要）
# Claude Code CLIのインストール（別途必要）

# 設定画面で有効化
./web-test config
```

### 2. テスト対象サイト設定

```bash
# 設定ファイルを編集
nano config/settings.json

# または対話式設定
./web-test config
```

### 3. 最初のテストケース作成

```bash
# Playwright録画でテストケース生成
./web-test generate

# URLを指定して録画
./web-test generate --url https://example.com
```

## 🚀 使用開始

インストール完了後：

```bash
# 1. テストケース作成（録画）
./web-test generate

# 2. テスト実行
./web-test run

# 3. レポート確認
ls -la reports/
```

## 📚 詳細ドキュメント

- [README.md](README.md) - プロジェクト概要
- [使用方法](README.md#使用方法) - 詳細な使い方
- [設定ガイド](README.md#設定ファイル) - 設定のカスタマイズ

## 💡 ヘルプ

問題が発生した場合：

1. ヘルスチェックを実行: `./scripts/health-check.sh`
2. ログを確認: `ls -la logs/`
3. README.mdのトラブルシューティングを参照
4. GitHubでIssueを作成