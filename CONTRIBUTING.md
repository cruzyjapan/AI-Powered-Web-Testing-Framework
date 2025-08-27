# Contributing to WebTestAI

まず、WebTestAIへの貢献を検討いただきありがとうございます！

## 🤝 貢献の方法

### バグ報告

バグを発見した場合は、[GitHub Issues](https://github.com/cruzyjapan/AI-Powered-Web-Testing-Framework/issues) で報告してください。

**バグ報告に含めてください:**
- バグの詳細な説明
- 再現手順
- 期待される動作
- 実際の動作
- スクリーンショット（可能であれば）
- 環境情報（OS、Node.jsバージョンなど）

### 機能提案

新機能のアイデアがある場合は、まずIssueを作成してディスカッションしましょう。

**機能提案に含めてください:**
- 機能の概要
- ユースケース
- 実装案（あれば）
- 影響範囲

### プルリクエスト

1. **Fork** - このリポジトリをフォークします
2. **Branch** - 機能ブランチを作成します (`git checkout -b feature/AmazingFeature`)
3. **Commit** - 変更をコミットします (`git commit -m 'Add some AmazingFeature'`)
4. **Push** - ブランチにプッシュします (`git push origin feature/AmazingFeature`)
5. **Pull Request** - プルリクエストを開きます

## 📝 コーディング規約

### JavaScript/Node.js

- ES6+の機能を積極的に使用
- セミコロンは省略しない
- インデントは2スペース
- 変数名はcamelCase
- 定数はUPPER_SNAKE_CASE
- クラス名はPascalCase

### コミットメッセージ

```
<type>: <subject>

<body>

<footer>
```

**Type:**
- feat: 新機能
- fix: バグ修正
- docs: ドキュメントのみの変更
- style: コードの意味に影響しない変更
- refactor: リファクタリング
- test: テストの追加・修正
- chore: ビルドプロセスやツールの変更

**例:**
```
feat: AI自動生成にセキュリティテストを追加

SQLインジェクションとXSSのテストケースを自動生成できるようになりました。
ページ解析時にフォーム入力を検出し、セキュリティテストを提案します。

Closes #123
```

## 🧪 テスト

新機能を追加する場合は、対応するテストも追加してください。

```bash
# テストの実行
npm test

# カバレッジレポート
npm run coverage
```

## 📚 ドキュメント

コードの変更に合わせて、以下のドキュメントも更新してください：

- README.md
- HELP.md
- JSDocコメント
- 必要に応じてWikiページ

## 🎯 開発環境のセットアップ

```bash
# リポジトリのクローン
git clone https://github.com/cruzyjapan/AI-Powered-Web-Testing-Framework.git
cd AI-Powered-Web-Testing-Framework

# 依存関係のインストール
npm install

# 開発モードで起動
npm run dev
```

## 📋 レビュープロセス

1. すべてのプルリクエストは最低1人のレビューが必要です
2. CI/CDパイプラインがすべて成功している必要があります
3. コードカバレッジが低下しないこと
4. ドキュメントが更新されていること

## 💬 質問がある場合

- [GitHub Discussions](https://github.com/cruzyjapan/AI-Powered-Web-Testing-Framework/discussions) で質問
- [Discord Server](https://discord.gg/xxxxx) でリアルタイムチャット

## 📄 ライセンス

このプロジェクトに貢献することで、あなたの貢献がMITライセンスの下でライセンスされることに同意したものとみなされます。