# WebTestAI - AI-Powered Web Testing Framework

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Playwright](https://img.shields.io/badge/Playwright-latest-blue)](https://playwright.dev)

AI駆動の次世代Web自動テストフレームワーク。URLを指定するだけで、AIがページを解析し網羅的なテストケースを自動生成します。

## 🌟 主な特徴

- **🤖 AI自動テスト生成** - URLだけで正常系・異常系・セキュリティテストを自動生成
- **🎬 Playwright録画** - ブラウザ操作を録画してテストケース化
- **🔄 デュアルAI対応** - Gemini CLIとClaude CLIを自由に切り替え
- **⏱️ 自動タイムアウト延長** - 最大1時間まで自動延長で複雑なテストにも対応
- **📊 多様な出力形式** - CSV/Excel/HTMLで標準的なテストレポート出力
- **🚀 ワンコマンド設定** - 初期設定から実行まで3分で完了

## 📋 動作環境

### 必須要件
- Ubuntu 20.04 LTS 以降 (WSL2対応)
- Node.js v18 以降
- npm 8.0 以降

### AI CLI（いずれか1つ）
- [Gemini CLI](https://github.com/reugn/gemini-cli)
- [Claude CLI](https://github.com/anthropics/claude-cli)

## 🚀 クイックスタート

### 1. インストール

```bash
# リポジトリのクローン
git clone https://github.com/cruzyjapan/AI-Powered-Web-Testing-Framework.git
cd AI-Powered-Web-Testing-Framework/

# 初期設定（依存関係インストール含む）
chmod +x init.sh web-test
./init.sh
```

### 2. AI CLI設定

```bash
# 利用可能なCLIを確認
./web-test switch

# Gemini CLIに切り替え
./web-test switch GEMINI

# Claude CLIに切り替え  
./web-test switch CLAUDE
```

### 3. テストケース生成

#### 🤖 AI自動生成（推奨）

```bash
# URLを指定して自動生成
./web-test auto-generate --url https://example.com

# 対話形式で生成
./web-test auto
```

#### 🎬 ブラウザ録画

```bash
# 対話形式で録画
./web-test generate

# URL指定で録画
./web-test generate --url https://example.com --name "ログインテスト"
```

### 4. テスト実行

```bash
# 全テストケース実行
./web-test run

# 特定テストケースのみ
./web-test run TC001 TC002

# カテゴリ別実行
./web-test run --category "セキュリティ"
```

### 5. レポート確認

```bash
# レポートディレクトリを開く
ls reports/

# HTMLレポートを表示
firefox reports/*/report.html
```

## 📂 プロジェクト構成

```
WebTestAI/
├── web-test              # メインコマンド
├── init.sh               # 初期設定スクリプト
├── config/
│   ├── settings.json     # 設定ファイル
│   └── test-cases.json   # テストケース定義
├── src/
│   ├── cli-manager.js    # AI CLI管理
│   ├── test-runner.js    # テスト実行エンジン
│   └── test-case-auto-generator.js  # AI自動生成
├── tests/                # 生成テストファイル
├── reports/              # テストレポート
└── screenshots/          # エビデンス画像
```

## 🎯 テスト作成方法の比較

| 機能 | AI自動生成 | 録画生成 |
|------|-----------|----------|
| **作成時間** | ⚡ 10-30秒 | ⏱️ 操作時間に依存 |
| **必要な操作** | 🔗 URLのみ | 🖱️ 実際のブラウザ操作 |
| **テスト網羅性** | 📊 ページ全体を解析 | 🎯 操作した部分のみ |
| **生成内容** | ✅ 正常系・異常系・セキュリティ | 📝 操作内容の再現 |

## 📊 出力形式

- **CSV** - Excel互換の標準テストシート
- **Excel** - 複数シートでの詳細レポート
- **HTML** - ビジュアルレポート（スクリーンショット付き）

## 🔧 設定ファイル

`config/settings.json`で以下を設定可能：

- AI CLIの選択とモデル設定
- テスト対象サイト情報
- 認証情報
- テストオプション（ヘッドレス、タイムアウト等）
- 出力形式

## 📝 コマンドリファレンス

```bash
# テストケース管理
./web-test cases --list          # 一覧表示
./web-test cases --delete TC001  # 削除

# 設定管理
./web-test config                # 設定UI表示

# ヘルプ
./web-test --help                # ヘルプ表示
./web-test --version             # バージョン確認
```

## 🤝 コントリビューション

プルリクエストや Issue の報告を歓迎します！

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 🙏 謝辞

- [Playwright](https://playwright.dev) - ブラウザ自動化
- [Gemini CLI](https://github.com/reugn/gemini-cli) - Google AI統合
- [Claude CLI](https://github.com/anthropics/claude-cli) - Anthropic AI統合

## 📧 サポート

問題や質問がある場合は、[Issues](https://github.com/cruzyjapan/AI-Powered-Web-Testing-Framework/issues) でお知らせください。