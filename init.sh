#!/bin/bash

# WebTestAI - AI CLI統合Webテストフレームワーク初期化スクリプト

set -e

echo "🚀 WebTestAI セットアップ開始"

# 必要なパッケージチェック・インストール
check_dependencies() {
    echo "📦 依存関係チェック中..."
    
    # Node.js チェック
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js が見つかりません"
        echo "   Node.js v18以降をインストールしてください"
        exit 1
    fi
    
    # Gemini CLI チェック（オプション）
    if ! command -v gemini &> /dev/null; then
        echo "⚠️  Gemini CLI が見つかりません（オプション）"
        echo "   Gemini CLIを使用する場合はインストールしてください"
    fi
    
    # Claude Code CLI チェック（オプション）
    if ! command -v claude &> /dev/null; then
        echo "⚠️  Claude Code CLI が見つかりません（オプション）"
        echo "   Claude Code CLIを使用する場合はインストールしてください"
    fi
    
    echo "✅ 基本依存関係 OK"
}

# ディレクトリ構造作成
create_directories() {
    echo "📁 ディレクトリ構造作成中..."
    
    directories=(
        "config/scenarios"
        "config/templates" 
        "src/utils"
        "scripts"
        "tests"
        "reports"
        "docs"
        "screenshots"
    )
    
    for dir in "${directories[@]}"; do
        mkdir -p "$dir"
        echo "  ✅ $dir"
    done
}

# 設定ファイル生成
generate_config() {
    echo "⚙️ 設定ファイル生成中..."
    
    cat > config/settings.json << 'EOL'
{
  "project_name": "WebTestAI",
  "version": "1.0.0",
  "ai_cli_settings": {
    "default_cli": "gemini",
    "gemini": {
      "enabled": true,
      "model": "gemini-2.5-pro",
      "timeout": 300,
      "auto_extend": true,
      "max_timeout": 3600,
      "comment": "timeout: 初期タイムアウト(秒), max_timeout: 最大実行時間(秒), auto_extend: 自動延長有効化"
    },
    "claude": {
      "enabled": true,
      "model": "claude-sonnet-4",
      "timeout": 300,
      "auto_extend": true,
      "max_timeout": 3600,
      "comment": "最大1時間まで自動的にタイムアウトを延長"
    }
  },
  "test_targets": [
    {
      "name": "ローカルWebサイト",
      "base_url": "http://localhost:3000",
      "admin_url": "http://localhost:3000/admin",
      "basic_auth": {
        "enabled": false,
        "username": "",
        "password": ""
      },
      "login_credentials": {
        "admin": {
          "email": "admin@example.com",
          "password": "password"
        },
        "user": {
          "email": "user@example.com",
          "password": "password"
        }
      }
    }
  ],
  "test_options": {
    "screenshot_enabled": true,
    "video_enabled": false,
    "trace_enabled": true,
    "retry_count": 2,
    "timeout": 30000,
    "headless": false
  },
  "output_settings": {
    "formats": ["csv", "excel", "html"],
    "screenshot_quality": 90,
    "report_title": "自動テスト実行結果"
  },
  "test_sheet_format": {
    "project_name": "WebTestAIプロジェクト",
    "version": "1.0.0",
    "tester_name": "AI自動テスト",
    "test_phase": "結合テスト"
  }
}
EOL

    # テストケース定義ファイル（空のテンプレート）
    cat > config/test-cases.json << 'EOL'
{
  "test_cases": [],
  "last_updated": "2024-12-28T00:00:00Z",
  "version": "1.0.0"
}
EOL

    echo "  ✅ config/settings.json"
    echo "  ✅ config/test-cases.json (空のテンプレート)"
    echo "  💡 テストケースは './web-test generate' で自動生成してください"
}

# Node.js依存関係インストール
install_node_dependencies() {
    echo "📦 Node.js依存関係インストール中..."
    
    cat > package.json << 'EOL'
{
  "name": "ai-cli-web-test-framework",
  "version": "1.0.0",
  "description": "AI CLI統合Webサイトテスト自動化フレームワーク",
  "main": "src/test-runner.js",
  "scripts": {
    "test": "node src/test-runner.js",
    "health": "./scripts/health-check.sh"
  },
  "dependencies": {
    "@playwright/test": "^1.40.0",
    "playwright": "^1.40.0",
    "commander": "^11.0.0",
    "dotenv": "^16.3.0",
    "csv-parser": "^3.0.0",
    "csv-writer": "^1.6.0",
    "xlsx": "^0.18.5",
    "marked": "^9.0.0",
    "chalk": "^5.3.0",
    "ora": "^7.0.0",
    "inquirer": "^9.2.0",
    "readline-sync": "^1.4.10"
  },
  "type": "module",
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
EOL

    npm install
    
    # Playwrightブラウザのインストール
    echo "🌐 Playwrightブラウザをインストール中..."
    npx playwright install
    
    echo "  ✅ Node.js依存関係インストール完了"
}

# 実行可能ファイル作成
create_executable() {
    echo "🔧 実行ファイル作成中..."
    
    cat > web-test << 'EOL'
#!/usr/bin/env node

import { program } from 'commander';
import TestRunner from './src/test-runner.js';
import ConfigManager from './src/config-manager.js';
import TestCaseGenerator from './src/test-case-generator.js';
import TestCaseManager from './src/test-case-manager.js';

program
  .name('web-test')
  .description('WebTestAI - AI-Powered Web Testing Framework')
  .version('1.0.0');

program
  .command('run')
  .description('テスト実行')
  .option('--cli <type>', 'AI CLI選択 (gemini|claude|auto)', 'auto')
  .option('--target <name>', 'テスト対象名')
  .option('--cases <ids>', 'テストケースID（カンマ区切り）')
  .option('--category <name>', 'テストカテゴリ')
  .option('--screenshot <on|off>', 'スクリーンショット', 'on')
  .option('--format <type>', '出力形式 (csv|excel|html)', 'excel')
  .option('--parallel <num>', '並列実行数', '1')
  .option('-v, --verbose', '詳細ログ')
  .action(async (options) => {
    const runner = new TestRunner(options);
    await runner.execute();
  });

program
  .command('switch <cli>')
  .description('デフォルトAI CLI切り替え')
  .action(async (cli) => {
    const config = new ConfigManager();
    await config.switchDefaultCli(cli);
  });

program
  .command('config')
  .description('設定画面表示')
  .action(async () => {
    const config = new ConfigManager();
    await config.showConfigUI();
  });

program
  .command('generate')
  .description('Playwrightでテストケース自動生成')
  .option('--url <url>', '対象URL指定')
  .option('--name <name>', 'テストケース名')
  .option('--edit <test_id>', '既存テストケース編集')
  .option('--headless <true|false>', 'ヘッドレスモード', 'false')
  .action(async (options) => {
    const generator = new TestCaseGenerator(options);
    await generator.startRecording();
  });

program
  .command('cases')
  .description('テストケース管理')
  .option('--list', 'テストケース一覧表示')
  .option('--delete <test_id>', 'テストケース削除')
  .action(async (options) => {
    const manager = new TestCaseManager();
    
    if (options.list) {
      await manager.listTestCases();
    } else if (options.delete) {
      await manager.deleteTestCase(options.delete);
    } else {
      await manager.showUI();
    }
  });

program.parse();
EOL

    chmod +x web-test
    echo "  ✅ web-test 実行ファイル作成完了"
}

# ヘルスチェックスクリプト作成
create_health_check() {
    echo "🔍 ヘルスチェックスクリプト作成中..."
    
    cat > scripts/health-check.sh << 'EOL'
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
EOL

    chmod +x scripts/health-check.sh
    echo "  ✅ scripts/health-check.sh"
}

# メイン実行
main() {
    check_dependencies
    create_directories
    generate_config
    install_node_dependencies
    create_executable
    create_health_check
    
    echo ""
    echo "🎉 セットアップ完了！"
    echo ""
    echo "📝 使用方法:"
    echo "  ./web-test config          # 基本設定"
    echo "  ./web-test generate        # テストケース自動生成（推奨）"
    echo "  ./web-test cases           # テストケース管理"
    echo "  ./web-test run             # テスト実行"
    echo "  ./web-test switch gemini   # AI CLI切り替え"
    echo "  ./scripts/health-check.sh  # システムチェック"
    echo ""
    echo "💡 まずは './web-test generate' でテストケースを作成してください！"
    echo ""
}

main "$@"