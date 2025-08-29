#!/bin/bash

echo "🔍 システムヘルスチェック"
echo "========================"

# Node.js
echo -n "Node.js: "
if command -v node &> /dev/null; then
    echo "✅ $(node --version)"
else
    echo "❌ 未インストール"
fi

# npm
echo -n "npm: "
if command -v npm &> /dev/null; then
    echo "✅ $(npm --version)"
else
    echo "❌ 未インストール"
fi

# Gemini CLI  
echo -n "Gemini CLI: "
if command -v gemini &> /dev/null; then
    echo "✅ インストール済み"
else
    echo "⚠️  未インストール（オプション）"
fi

# Claude Code CLI
echo -n "Claude Code CLI: "
if command -v claude &> /dev/null; then
    echo "✅ インストール済み"
else
    echo "⚠️  未インストール（オプション）"
fi

# Playwright
echo -n "Playwright: "
if npx playwright --version &> /dev/null 2>&1; then
    echo "✅ $(npx playwright --version)"
else
    echo "❌ 未インストール"
fi

# ディレクトリチェック
echo ""
echo "📁 ディレクトリ構造:"
dirs=("config" "src" "scripts" "tests" "reports" "docs" "screenshots")
for dir in "${dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo "  ✅ $dir/"
    else
        echo "  ❌ $dir/ (不足)"
    fi
done

# 設定ファイルチェック
echo ""
echo "📄 設定ファイル:"
if [ -f "config/settings.json" ]; then
    echo "  ✅ config/settings.json"
else
    echo "  ❌ config/settings.json (不足)"
fi

if [ -f "config/test-cases.json" ]; then
    echo "  ✅ config/test-cases.json"
else
    echo "  ❌ config/test-cases.json (不足)"
fi

echo ""
echo "✅ ヘルスチェック完了"
