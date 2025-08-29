#!/bin/bash

# WebTestAI - 簡単セットアップスクリプト
# このスクリプトで、WebTestAIフレームワークを自動構築します

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 WebTestAI 自動構築スクリプト"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 現在のディレクトリを保存
CURRENT_DIR=$(pwd)

echo -e "${BLUE}📁 作業ディレクトリ: $CURRENT_DIR${NC}"
echo ""

# 1. Node.js確認
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Step 1: 環境チェック"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_nodejs() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"
        
        # バージョンチェック（v18以上が必要）
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$MAJOR_VERSION" -lt 18 ]; then
            echo -e "${YELLOW}⚠️  Node.js v18以降が推奨されます${NC}"
            echo ""
            echo "アップグレード方法："
            echo "  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
            echo "  sudo apt-get install -y nodejs"
            echo ""
            read -p "続行しますか？ (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    else
        echo -e "${RED}❌ Node.jsがインストールされていません${NC}"
        echo ""
        echo "インストール方法："
        echo "  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
        echo "  sudo apt-get install -y nodejs"
        echo ""
        exit 1
    fi
    
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        echo -e "${GREEN}✅ npm: $NPM_VERSION${NC}"
    else
        echo -e "${RED}❌ npmがインストールされていません${NC}"
        exit 1
    fi
}

check_nodejs

# 2. 必要なシステムパッケージ確認
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Step 2: システムパッケージ確認"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_system_packages() {
    MISSING_PACKAGES=""
    
    # 必要なパッケージリスト
    REQUIRED_PACKAGES="curl wget git"
    
    for pkg in $REQUIRED_PACKAGES; do
        if command -v $pkg &> /dev/null; then
            echo -e "${GREEN}✅ $pkg: インストール済み${NC}"
        else
            echo -e "${YELLOW}⚠️  $pkg: 未インストール${NC}"
            MISSING_PACKAGES="$MISSING_PACKAGES $pkg"
        fi
    done
    
    if [ ! -z "$MISSING_PACKAGES" ]; then
        echo ""
        echo -e "${YELLOW}以下のパッケージをインストールすることを推奨します：${NC}"
        echo "  sudo apt-get update"
        echo "  sudo apt-get install -y $MISSING_PACKAGES"
        echo ""
        read -p "今すぐインストールしますか？ (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo apt-get update
            sudo apt-get install -y $MISSING_PACKAGES
        fi
    fi
}

check_system_packages

# 3. ファイル構造確認
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Step 3: ファイル構造確認"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_files() {
    MISSING_FILES=""
    
    # 必須ファイルリスト
    REQUIRED_FILES=(
        "init.sh"
        "web-test"
        "src/config-manager.js"
        "src/test-case-generator.js"
        "src/test-case-manager.js"
        "src/test-runner.js"
        "src/test-sheet-generator.js"
        "src/cli-manager.js"
        "src/utils/logger.js"
        "src/utils/screenshot.js"
    )
    
    for file in "${REQUIRED_FILES[@]}"; do
        if [ -f "$file" ]; then
            echo -e "${GREEN}✅ $file${NC}"
        else
            echo -e "${RED}❌ $file が見つかりません${NC}"
            MISSING_FILES="$MISSING_FILES $file"
        fi
    done
    
    if [ ! -z "$MISSING_FILES" ]; then
        echo ""
        echo -e "${RED}必要なファイルが不足しています。${NC}"
        echo "GitHubリポジトリからクローンするか、ファイルを配置してください。"
        exit 1
    fi
}

check_files

# 4. 実行権限設定
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Step 4: 実行権限設定"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

set_permissions() {
    chmod +x init.sh 2>/dev/null && echo -e "${GREEN}✅ init.sh に実行権限を付与${NC}" || echo -e "${YELLOW}⚠️  init.sh 権限設定スキップ${NC}"
    chmod +x web-test 2>/dev/null && echo -e "${GREEN}✅ web-test に実行権限を付与${NC}" || echo -e "${YELLOW}⚠️  web-test 権限設定スキップ${NC}"
    
    if [ -d "scripts" ]; then
        chmod +x scripts/*.sh 2>/dev/null && echo -e "${GREEN}✅ scripts/*.sh に実行権限を付与${NC}" || echo -e "${YELLOW}⚠️  scripts 権限設定スキップ${NC}"
    fi
}

set_permissions

# 5. 初期化実行
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Step 5: WebTestAI 初期化"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "init.sh を実行してWebTestAIを初期化しますか？ (Y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo -e "${YELLOW}初期化をスキップしました。後で './init.sh' を実行してください。${NC}"
else
    echo -e "${BLUE}初期化を開始します...${NC}"
    echo ""
    ./init.sh
fi

# 6. Playwright依存関係（オプション）
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Step 6: Playwright システム依存関係（オプション）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Playwrightブラウザを使用するには、システム依存関係が必要です。"
echo ""

read -p "Playwright依存関係をインストールしますか？ (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Playwright依存関係をインストール中...${NC}"
    sudo npx playwright install-deps
    echo -e "${GREEN}✅ Playwright依存関係インストール完了${NC}"
fi

# 7. 完了
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 WebTestAI セットアップ完了！${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 使用方法："
echo ""
echo "  1. ヘルスチェック:"
echo "     ${BLUE}./scripts/health-check.sh${NC}"
echo ""
echo "  2. 設定管理:"
echo "     ${BLUE}./web-test config${NC}"
echo ""
echo "  3. テストケース作成（Playwright録画）:"
echo "     ${BLUE}./web-test generate${NC}"
echo ""
echo "  4. テスト実行:"
echo "     ${BLUE}./web-test run${NC}"
echo ""
echo "  5. ヘルプ表示:"
echo "     ${BLUE}./web-test --help${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 最終確認
echo "🔍 動作確認を実行しますか？"
read -p "(ヘルスチェックを実行) (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo ""
    ./scripts/health-check.sh
fi

echo ""
echo -e "${GREEN}✨ セットアップが完了しました！${NC}"
echo "詳しい使い方は README.md を参照してください。"