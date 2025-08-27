# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-08-27

### 🎉 Initial Release

#### Added
- **AI自動テスト生成** - URLを指定するだけでAIがテストケースを自動生成
  - 正常系テストケース
  - 異常系テストケース
  - セキュリティテストケース（SQLインジェクション、XSS対策）
- **Playwright録画機能** - ブラウザ操作を録画してテストケース作成
- **デュアルAI CLI対応** 
  - Gemini CLI統合
  - Claude CLI統合
  - 自動切り替え機能
- **自動タイムアウト延長** - 最大1時間まで5分単位で自動延長
- **多様な出力形式**
  - CSV形式（Excel互換）
  - Excel形式（複数シート）
  - HTML形式（ビジュアルレポート）
- **対話型設定管理** - GUIライクな設定インターフェース
- **テストケース管理機能**
  - 一覧表示
  - 個別削除
  - カテゴリ別実行

#### Fixed
- Gemini CLIのタイムアウト問題を修正
- Claude CLIの複雑なプロンプト処理を改善
- トレース機能のエラーハンドリング改善

#### Security
- 認証情報のダミー化
- テストデータのサニタイズ

### Known Issues
- 並列実行は現在未対応（将来バージョンで実装予定）
- Windows ネイティブ環境は未対応（WSL2を推奨）