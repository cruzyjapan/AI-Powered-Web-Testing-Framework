#!/bin/bash

# ================================================================
# WSL2 日本語環境セットアップスクリプト
# Windows 11 + WSL2でPlaywrightの文字化けを解決
# ================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 WSL2 日本語環境セットアップを開始します"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# システムアップデート
echo "📦 システムパッケージを更新中..."
sudo apt update && sudo apt upgrade -y

# 日本語フォントインストール
echo ""
echo "🔤 日本語フォントをインストール中..."
sudo apt install -y \
  fonts-noto-cjk \
  fonts-noto-cjk-extra \
  fonts-ipafont \
  fonts-ipaexfont \
  fonts-takao

# 日本語ロケール設定
echo ""
echo "🌏 日本語ロケールを設定中..."
sudo locale-gen ja_JP.UTF-8
sudo update-locale LANG=ja_JP.UTF-8

# 環境変数設定
export LANG=ja_JP.UTF-8
export LC_ALL=ja_JP.UTF-8
export LC_CTYPE=ja_JP.UTF-8

# bashrcに永続化（重複チェック付き）
if ! grep -q "export LANG=ja_JP.UTF-8" ~/.bashrc; then
  echo "" >> ~/.bashrc
  echo "# 日本語環境設定" >> ~/.bashrc
  echo 'export LANG=ja_JP.UTF-8' >> ~/.bashrc
  echo 'export LC_ALL=ja_JP.UTF-8' >> ~/.bashrc
  echo 'export LC_CTYPE=ja_JP.UTF-8' >> ~/.bashrc
fi

# Playwright依存関係
echo ""
echo "🎭 Playwright依存関係をインストール中..."
sudo apt-get install -y \
  libnspr4 \
  libnss3 \
  libasound2t64 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libatspi2.0-0 \
  libcups2 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  libglib2.0-0 \
  libpango-1.0-0 \
  libcairo2 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxext6 \
  libxi6

# フォントキャッシュ更新
echo ""
echo "🔄 フォントキャッシュを更新中..."
fc-cache -fv > /dev/null 2>&1

# 設定確認
echo ""
echo "📋 現在の設定を確認中..."
echo "  LANG: $LANG"
echo "  LC_ALL: $LC_ALL"
echo "  LC_CTYPE: $LC_CTYPE"

# ロケール確認
locale | grep ja_JP > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "  ✅ 日本語ロケール: 有効"
else
  echo "  ⚠️  日本語ロケール: 要再起動"
fi

# フォント確認
fc-list | grep -i noto > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "  ✅ 日本語フォント: インストール済み"
else
  echo "  ⚠️  日本語フォント: 未検出"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ WSL2日本語環境セットアップ完了！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  重要: 設定を反映するには以下のいずれかを実行してください："
echo "   1. source ~/.bashrc"
echo "   2. 新しいターミナルセッションを開く"
echo "   3. WSL2を再起動する"
echo ""
echo "📝 テスト方法:"
echo "   ./web-test generate --url https://example.com"
echo ""