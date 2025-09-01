# 🚀 WebTestAI クイックスタートガイド

## 3分で始めるAI自動テスト

### ステップ1: インストール（1分）

```bash
# リポジトリをクローン
git clone https://github.com/cruzyjapan/AI-Powered-Web-Testing-Framework.git
cd AI-Powered-Web-Testing-Framework/

# 初期化
chmod +x init.sh web-test
./init.sh
```

### ステップ2: AI自動テスト生成（1分）

```bash
# URLを指定するだけでテストケースを自動生成！
./web-test auto-generate http://localhost:4009/

# 不足手順は自動補完されます（アクセス→操作→遷移待機）
```

**実行結果例:**
```
🤖 AI駆動ページ解析開始
✔ ページ解析完了
🧠 AI CLIでテストケースを生成中...
✅ 10個のテストケースを生成しました
📝 保存完了: TC001, TC002, TC003, TC004, TC005, TC006, TC007, TC008, TC009, TC010
```

### ステップ3: 最適化＋テスト実行（1分）

```bash
# 古い/汎用的なケースをクリーンアップ（推奨）
./web-test optimize --mode cleanup --auto-save

# 生成されたテストケースを全て実行（safeClickで安定遷移）
./web-test run --browser chromium --no-prompt
```

**実行結果例:**
```
🚀 テスト実行開始
📋 実行予定: 10件のテストケース
✅ テスト実行完了
📊 成功: 10 / 失敗: 0 / 成功率: 100%
📁 レポート: reports/2025-08-28T00-00-00/
```

## 📝 実践例

### ローカル開発環境のテスト

```bash
# Node.jsアプリケーション
./web-test auto-generate http://localhost:3000/

# Django/Railsアプリケーション  
./web-test auto-generate http://localhost:8000/

# React/Vue開発サーバー
./web-test auto-generate http://localhost:5173/
```

### 本番環境のテスト

```bash
# 本番サイトのテスト
./web-test auto-generate https://your-website.com/

# ステージング環境
./web-test auto-generate https://staging.your-website.com/
```

### AI CLI別の使用例

```bash
# Gemini CLIを使用
./web-test auto --url http://localhost:4009/ --cli gemini

# Claude CLIを使用  
./web-test auto --url http://localhost:4009/ --cli claude
```

## 🎯 生成されるテストケース

1つのURLから以下のようなテストケースが自動生成されます：

- ✅ **基本機能テスト** - ページ表示、リンク遷移
- ✅ **フォームテスト** - 正常入力、必須項目チェック
- ✅ **エラーハンドリング** - 異常値入力、エラー表示
- ✅ **セキュリティテスト** - XSS/SQL（アクセス→フィールド待機→クリア→入力→送信→待機→ダイアログ未発火確認）
- ✅ **UIテスト** - ボタンクリック、要素表示確認

## 💡 Tips

### より詳細なテストを生成したい場合

```bash
# Claude CLIは詳細なテストケースを生成する傾向があります
./web-test auto --url <URL> --cli claude
```

### 高速にテスト生成したい場合

```bash
# Gemini CLIは高速に応答します
./web-test auto --url <URL> --cli gemini
```

### ヘッドレスモードで実行

```bash
# ブラウザを表示せずにバックグラウンドで実行
./web-test auto --url <URL> --headless
```

## 🔍 次のステップ

- [詳細な使い方](HELP.md)
- [設定のカスタマイズ](README.md#設定ファイル)
- [トラブルシューティング](HELP.md#トラブルシューティング)

---

**🎉 これだけで自動テストが始められます！**

URLを指定するだけで、AIが自動的にテストケースを生成し、実行してレポートを作成します。
