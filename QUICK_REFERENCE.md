# 🚀 WebTestAI クイックリファレンス

## 📌 必須コマンド（これだけ覚えればOK）

```bash
# 1. テストケース作成（AI自動生成 - 新機能！）
./web-test auto --url http://localhost:3000/

# 2. テストケース作成（手動録画）
./web-test generate

# 3. テスト実行
./web-test run

# 4. AI CLI切り替え
./web-test switch gemini    # または claude, auto
```

## 🎯 よく使うコマンド

### 基本操作
```bash
./web-test --help           # ヘルプ表示
./web-test config           # 設定画面
./web-test cases            # テストケース管理
./scripts/health-check.sh   # 環境確認
```

### AI CLI切り替え
```bash
./web-test switch gemini    # Gemini使用
./web-test switch claude    # Claude使用
./web-test switch auto      # 自動選択
```

### テストケース操作
```bash
./web-test auto --url https://example.com      # AI自動生成（推奨）
./web-test generate                            # 手動録画
./web-test generate --url https://example.com  # URL指定録画
./web-test cases --list                        # 一覧表示
./web-test cases --delete TC001                # 削除
```

### テスト実行
```bash
./web-test run                          # 全テスト実行
./web-test run --cli gemini            # CLI指定実行
./web-test run --cases TC001,TC002     # 特定テスト実行
./web-test run --format excel          # Excel出力
```

## ⚠️ よくある間違いと正しい使い方

| ❌ 間違い | ✅ 正しい | 説明 |
|----------|----------|------|
| `./switch gemini` | `./web-test switch gemini` | switchはサブコマンド |
| `./run` | `./web-test run` | runはサブコマンド |
| `./generate` | `./web-test generate` | generateはサブコマンド |
| `npm run test` | `./web-test run` | 専用コマンドを使用 |

## 📁 重要なファイル

```
config/
├── settings.json     # メイン設定
└── test-cases.json   # テストケース

reports/              # テスト結果
screenshots/          # スクリーンショット
logs/                 # ログファイル
```

## 🔧 設定変更

### GUI経由（推奨）
```bash
./web-test config
```

### 直接編集
```bash
nano config/settings.json
```

## 🆘 困ったときは

```bash
# 1. ヘルスチェック
./scripts/health-check.sh

# 2. ヘルプ確認
./web-test --help
cat HELP.md

# 3. ログ確認
ls -la logs/

# 4. 権限修正
chmod +x web-test init.sh
```

## 📊 テスト実行フロー

```
1. generate → テストケース作成
     ↓
2. cases --list → 確認
     ↓
3. run → 実行
     ↓
4. reports/ → 結果確認
```

## 💡 プロのTips

### 効率的なテスト作成
```bash
# URLごとにまとめて録画
./web-test generate --url https://example.com/login
./web-test generate --url https://example.com/products
```

### バッチ実行
```bash
# カテゴリごとに実行
./web-test run --category "ログイン機能" --format excel
./web-test run --category "商品検索" --format csv
```

### CI/CD統合
```bash
# ヘッドレス&自動CLI選択
./web-test run --cli auto --format csv --screenshot off
```

---
📚 詳細: [README.md](README.md) | [HELP.md](HELP.md) | [INSTALL.md](INSTALL.md)