import fs from 'fs';
import path from 'path';
import { chromium, firefox, webkit } from 'playwright';
import chalk from 'chalk';
import ora from 'ora';
import ConfigManager from './config-manager.js';
import TestSheetGenerator from './test-sheet-generator.js';
import CLIManager from './cli-manager.js';
import Logger from './utils/logger.js';
import ScreenshotManager from './utils/screenshot.js';

// Playwright設定を読み込み
let playwrightConfig = {};
try {
  const configPath = path.join(process.cwd(), 'playwright.config.js');
  if (fs.existsSync(configPath)) {
    const configModule = await import('file://' + configPath);
    playwrightConfig = configModule.default || configModule;
  }
} catch (error) {
  // 設定ファイルが存在しない場合はデフォルト設定を使用
  console.log('playwright.config.js not found, using defaults');
}

class TestRunner {
  constructor(options = {}) {
    this.options = options;
    this.configManager = new ConfigManager();
    this.config = this.configManager.config;
    this.cliManager = new CLIManager(this.config);
    this.logger = new Logger(options.verbose);
    this.screenshotManager = new ScreenshotManager(this.config);
    this.testCases = { test_cases: [] }; // executeで読み込み
    this.results = [];
    this.browser = null;
    this.context = null;
    this.page = null;
    this.browserType = options.browser || 'chromium'; // デフォルトはChromium
  }

  /**
   * ブラウザタイプに応じたPlaywrightブラウザを取得
   */
  getBrowser(type) {
    const browsers = {
      'chromium': chromium,
      'firefox': firefox,
      'webkit': webkit,
      'chrome': chromium, // エイリアス
      'safari': webkit    // エイリアス
    };
    return browsers[type.toLowerCase()] || chromium;
  }

  async loadTestCases() {
    const configDir = path.join(process.cwd(), 'config');
    
    // テストケースファイルを検索
    const testFiles = fs.readdirSync(configDir)
      .filter(file => file.startsWith('test-cases') && file.endsWith('.json'))
      .sort((a, b) => {
        // test-cases.json を最優先
        if (a === 'test-cases.json') return -1;
        if (b === 'test-cases.json') return 1;
        // その他は更新日時順
        const statA = fs.statSync(path.join(configDir, a));
        const statB = fs.statSync(path.join(configDir, b));
        return statB.mtime - statA.mtime;
      });
    
    if (testFiles.length === 0) {
      return { test_cases: [] };
    }
    
    // ファイル選択オプションがある場合
    if (this.options.testFile) {
      const selectedFile = testFiles.find(f => f === this.options.testFile);
      if (selectedFile) {
        const data = fs.readFileSync(path.join(configDir, selectedFile), 'utf8');
        console.log(chalk.blue(`📁 使用ファイル: ${selectedFile}`));
        return JSON.parse(data);
      }
    }
    
    // 複数ファイルがある場合は選択
    if (testFiles.length > 1 && !this.options.noPrompt) {
      const { default: inquirer } = await import('inquirer');
      
      const choices = testFiles.map(file => {
        const stats = fs.statSync(path.join(configDir, file));
        const size = (stats.size / 1024).toFixed(1);
        const date = stats.mtime.toLocaleString();
        return {
          name: `${file} (${size}KB, 更新: ${date})`,
          value: file
        };
      });
      
      const answer = await inquirer.prompt([{
        type: 'list',
        name: 'testFile',
        message: 'テストケースファイルを選択してください:',
        choices,
        default: 0
      }]);
      
      const data = fs.readFileSync(path.join(configDir, answer.testFile), 'utf8');
      console.log(chalk.blue(`📁 選択ファイル: ${answer.testFile}`));
      return JSON.parse(data);
    }
    
    // デフォルト（最新または test-cases.json）
    const defaultFile = testFiles[0];
    const data = fs.readFileSync(path.join(configDir, defaultFile), 'utf8');
    console.log(chalk.blue(`📁 使用ファイル: ${defaultFile}`));
    return JSON.parse(data);
  }

  async execute() {
    console.log(chalk.cyan('\n🚀 テスト実行開始\n'));

    // テストケースを読み込み
    this.testCases = await this.loadTestCases();

    // テストケースのフィルタリング
    const testCasesToRun = this.filterTestCases();
    
    if (testCasesToRun.length === 0) {
      console.log(chalk.yellow('⚠️  実行するテストケースがありません'));
      console.log(chalk.gray('💡 "./web-test generate" または "./web-test auto" でテストケースを作成してください'));
      return;
    }

    console.log(chalk.blue(`📋 実行予定: ${testCasesToRun.length}件のテストケース`));
    
    // ターゲット選択
    const target = this.configManager.getTestTarget(this.options.target);
    if (!target) {
      console.error(chalk.red('❌ テスト対象が設定されていません'));
      return;
    }

    console.log(chalk.blue(`🎯 テスト対象: ${target.name} (${target.base_url})`));
    console.log(chalk.blue(`🤖 使用CLI: ${this.options.cli || this.config.ai_cli_settings.default_cli}`));
    
    // 全ブラウザで実行する場合
    if (this.browserType === 'all') {
      console.log(chalk.magenta('🌐 全ブラウザでテストを実行します'));
      const browsers = ['chromium', 'firefox', 'webkit'];
      const allResults = {};
      
      for (const browser of browsers) {
        console.log(chalk.cyan(`\n=== ${browser.toUpperCase()} でのテスト開始 ===\n`));
        this.browserType = browser;
        this.results = []; // 結果をリセット
        await this.executeWithBrowser(testCasesToRun, target);
        allResults[browser] = [...this.results];
      }
      
      // 全ブラウザの結果をサマリー表示
      this.showCrossBrowserSummary(allResults);
      return;
    }

    // 単一ブラウザで実行
    await this.executeWithBrowser(testCasesToRun, target);
  }

  async executeWithBrowser(testCasesToRun, target) {
    // レポートディレクトリ作成
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const browserSuffix = this.browserType !== 'chromium' ? `-${this.browserType}` : '';
    const reportDir = path.join(process.cwd(), 'reports', `${timestamp}${browserSuffix}`);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    // テスト実行
    const startTime = Date.now();
    let browserLaunched = false;
    
    try {
      // ブラウザ起動
      await this.launchBrowser(target);
      browserLaunched = true;
      
      // 各テストケースを実行
      for (const testCase of testCasesToRun) {
        await this.executeTestCase(testCase, target, reportDir);
      }

    } catch (error) {
      this.logger.error('テスト実行エラー:', error.message);
    } finally {
      // トレースを先に停止（ブラウザが起動している場合のみ）
      if (browserLaunched && this.config.test_options.trace_enabled && this.context) {
        try {
          const tracePath = path.join(reportDir, 'trace.zip');
          await this.context.tracing.stop({ path: tracePath });
          console.log(chalk.green(`✅ トレース保存: trace.zip`));
        } catch (traceError) {
          // トレースエラーは警告のみ（処理は継続）
          if (this.options.verbose) {
            this.logger.warn('トレース停止エラー（無視）:', traceError.message);
          }
        }
      }
      
      // ブラウザ終了
      if (browserLaunched && this.browser) {
        try {
          await this.browser.close();
        } catch (closeError) {
          // ブラウザクローズエラーも無視
          if (this.options.verbose) {
            this.logger.warn('ブラウザ終了エラー（無視）:', closeError.message);
          }
        }
      }
    }

    const endTime = Date.now();
    const totalTime = Math.round((endTime - startTime) / 1000);

    // 結果サマリー表示
    this.showResultsSummary(totalTime);

    // テストシート生成
    await this.generateReports(reportDir);
    
    console.log(chalk.green(`\n✅ テスト実行完了`));
    // timestampは既に宣言済みなので、reportDirから抽出
    const reportDirName = path.basename(reportDir);
    console.log(chalk.blue(`📁 レポート: reports/${reportDirName}/`));
  }

  /**
   * クロスブラウザテストの結果サマリー表示
   */
  showCrossBrowserSummary(allResults) {
    console.log(chalk.cyan('\n📊 クロスブラウザテスト結果サマリー'));
    console.log(chalk.gray('═'.repeat(60)));
    
    const summary = {};
    let totalTests = 0;
    
    // 各ブラウザの結果を集計
    Object.entries(allResults).forEach(([browser, results]) => {
      const passed = results.filter(r => r.status === 'PASS').length;
      const failed = results.filter(r => r.status === 'FAIL').length;
      const errors = results.filter(r => r.status === 'ERROR').length;
      const total = results.length;
      const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
      
      summary[browser] = {
        passed,
        failed,
        errors,
        total,
        passRate
      };
      
      totalTests = Math.max(totalTests, total);
    });
    
    // ブラウザごとの結果表示
    Object.entries(summary).forEach(([browser, stats]) => {
      const browserName = browser.toUpperCase().padEnd(10);
      const statusIcon = stats.passRate === 100 ? '✅' : 
                         stats.passRate >= 80 ? '⚠️' : '❌';
      
      console.log(`\n${statusIcon} ${chalk.bold(browserName)}`);
      console.log(`   成功: ${chalk.green(stats.passed)}/${stats.total}`);
      console.log(`   失敗: ${chalk.red(stats.failed)}`);
      console.log(`   エラー: ${chalk.yellow(stats.errors)}`);
      console.log(`   成功率: ${stats.passRate}%`);
    });
    
    // 互換性分析
    console.log(chalk.cyan('\n🔍 ブラウザ互換性分析'));
    console.log(chalk.gray('─'.repeat(40)));
    
    // 全ブラウザで成功したテスト
    const allPassed = [];
    const someFailed = [];
    
    if (totalTests > 0) {
      for (let i = 0; i < totalTests; i++) {
        let passCount = 0;
        let testName = '';
        
        Object.entries(allResults).forEach(([browser, results]) => {
          if (results[i]) {
            testName = results[i].test_name;
            if (results[i].status === 'PASS') {
              passCount++;
            }
          }
        });
        
        if (passCount === Object.keys(allResults).length) {
          allPassed.push(testName);
        } else if (passCount < Object.keys(allResults).length && passCount > 0) {
          someFailed.push(testName);
        }
      }
      
      if (allPassed.length > 0) {
        console.log(chalk.green(`✅ 全ブラウザ成功: ${allPassed.length}件`));
      }
      
      if (someFailed.length > 0) {
        console.log(chalk.yellow(`⚠️  一部ブラウザで失敗: ${someFailed.length}件`));
        someFailed.slice(0, 5).forEach(test => {
          console.log(chalk.gray(`   - ${test}`));
        });
        if (someFailed.length > 5) {
          console.log(chalk.gray(`   他 ${someFailed.length - 5}件...`));
        }
      }
    }
    
    console.log(chalk.gray('═'.repeat(60)));
  }

  filterTestCases() {
    let testCases = [...this.testCases.test_cases];
    
    // IDフィルター
    if (this.options.cases) {
      const caseIds = this.options.cases.split(',').map(id => id.trim());
      testCases = testCases.filter(tc => caseIds.includes(tc.test_id));
    }
    
    // カテゴリフィルター
    if (this.options.category) {
      testCases = testCases.filter(tc => tc.test_category === this.options.category);
    }
    
    return testCases;
  }

  async launchBrowser(target) {
    const spinner = ora('ブラウザを起動中...').start();
    
    try {
      const headless = this.config.test_options.headless;
      
      // playwright.config.jsの設定を適用（オートコンプリート無効化含む）
      const defaultArgs = [
        '--start-maximized', 
        '--lang=ja-JP',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=TranslateUI',
        '--disable-autofill',
        '--disable-save-password-bubble',
        '--disable-password-generation',
        '--no-default-browser-check'
      ];
      const configArgs = playwrightConfig?.use?.launchOptions?.args || [];
      
      // ブラウザタイプに応じて起動
      const browserToUse = this.getBrowser(this.browserType);
      const browserName = this.browserType.toLowerCase();
      
      console.log(chalk.cyan(`🌐 使用ブラウザ: ${browserName.toUpperCase()}`));
      
      this.browser = await browserToUse.launch({
        headless: headless,
        args: browserName === 'chromium' || browserName === 'chrome' ? 
          [...new Set([...defaultArgs, ...configArgs])] : [],
        ...(playwrightConfig?.use?.launchOptions || {})
      });

      // 保存されたログイン状態があるか確認
      const storageStatePath = path.join(process.cwd(), 'config', 'auth-state.json');
      let storageState = null;
      
      if (fs.existsSync(storageStatePath)) {
        console.log(chalk.green('🔐 保存されたログイン状態を検出しました'));
        storageState = storageStatePath;
      }
      
      // コンテキスト設定を統合（オートコンプリート無効化を含む）
      this.context = await this.browser.newContext({
        viewport: null,
        locale: playwrightConfig?.use?.locale || 'ja-JP',
        timezoneId: playwrightConfig?.use?.timezoneId || 'Asia/Tokyo',
        // ブラウザのオートコンプリート・パスワード保存を無効化
        ignoreHTTPSErrors: true,
        bypassCSP: true,
        ...(playwrightConfig?.use?.contextOptions || {}),
        recordVideo: this.config.test_options.video_enabled ? {
          dir: path.join(process.cwd(), 'reports', 'videos')
        } : undefined,
        // ログイン状態を復元
        ...(storageState ? { storageState } : {})
      });
      
      if (storageState) {
        console.log(chalk.green('✅ ログイン状態を復元しました'));
      }
      
      // トレースを明示的に開始
      if (this.config.test_options.trace_enabled) {
        await this.context.tracing.start({
          screenshots: true,
          snapshots: true,
          sources: true
        });
      }

      // Basic認証設定
      if (target.basic_auth && target.basic_auth.enabled) {
        await this.context.setHTTPCredentials({
          username: target.basic_auth.username,
          password: target.basic_auth.password
        });
      }

      this.page = await this.context.newPage();
      
      // タイムアウト設定
      this.page.setDefaultTimeout(this.config.test_options.timeout);
      
      spinner.succeed('ブラウザを起動しました');
    } catch (error) {
      spinner.fail('ブラウザ起動に失敗しました');
      throw error;
    }
  }

  async executeTestCase(testCase, target, reportDir) {
    // テストケースの詳細を事前表示
    console.log(chalk.blue('\n━'.repeat(60)));
    console.log(chalk.bold.blue(`📋 テストケース: ${testCase.test_id} - ${testCase.test_case_name}`));
    console.log(chalk.cyan(`   カテゴリ: ${testCase.test_category || '未分類'}`));
    console.log(chalk.cyan(`   優先度: ${testCase.priority || 'medium'}`));
    console.log(chalk.cyan(`   対象URL: ${testCase.target_url || target.base_url || 'デフォルト'}`));
    console.log(chalk.cyan(`   ステップ数: ${testCase.test_steps?.length || 0}`));
    
    // 入力値の事前確認
    if (testCase.test_steps && testCase.test_steps.length > 0) {
      const hasInputs = testCase.test_steps.some(step => 
        step.action === 'fill' || 
        step.action === 'select' ||
        step.description?.includes('入力') ||
        step.description?.includes('選択')
      );
      
      if (hasInputs) {
        console.log(chalk.yellow('\n📝 テストで使用される入力値:'));
        testCase.test_steps.forEach((step, index) => {
          if (step.action === 'fill' && step.value) {
            const isPassword = step.target?.includes('password') || 
                             step.description?.includes('パスワード');
            const displayValue = isPassword ? '*'.repeat(step.value.length) : step.value;
            console.log(chalk.gray(`   ${index + 1}. ${step.description || 'フィールド入力'}: 「${displayValue}」`));
          } else if (step.action === 'select' && step.value) {
            console.log(chalk.gray(`   ${index + 1}. ${step.description || '選択'}: 「${step.value}」`));
          } else if (step.action === 'check' || step.action === 'uncheck') {
            const action = step.action === 'check' ? 'チェック' : 'チェック解除';
            console.log(chalk.gray(`   ${index + 1}. ${step.description || action}: ${step.target}`));
          }
        });
      }
    }
    
    console.log(chalk.blue('━'.repeat(60) + '\n'));
    
    const startTime = Date.now();
    const spinner = ora(`${testCase.test_id}: ${testCase.test_case_name}`).start();
    
    const result = {
      test_id: testCase.test_id,
      test_name: testCase.test_case_name,
      test_category: testCase.test_category,
      priority: testCase.priority,
      status: 'PENDING',
      execution_date: new Date().toISOString(),
      execution_time: 0,
      actual_result: '',
      error: null,
      screenshot: null,
      cli: this.options.cli || this.config.ai_cli_settings.default_cli,
      remarks: ''
    };

    try {
      // AI CLIを使用するかどうかの判断
      const useAICLI = this.shouldUseAICLI(testCase);
      
      if (useAICLI) {
        // AI CLIでテスト実行
        await this.executeWithAICLI(testCase, target, result);
      } else {
        // Playwrightで直接実行
        await this.executeWithPlaywright(testCase, target, result, reportDir);
      }
      
      // アサーション実行
      if (testCase.assertion) {
        await this.executeAssertion(testCase.assertion, result);
      }
      
      if (!result.error) {
        result.status = 'PASS';
        result.actual_result = testCase.expected_result;
        spinner.succeed(`${testCase.test_id}: ${testCase.test_case_name} - ${chalk.green('PASS')}`);
      }
      
    } catch (error) {
      result.status = 'FAIL';
      result.error = error.message;
      result.actual_result = `エラー: ${error.message}`;
      spinner.fail(`${testCase.test_id}: ${testCase.test_case_name} - ${chalk.red('FAIL')}`);
      this.logger.error(`  ${error.message}`);
      
      // リトライ処理
      if (this.config.test_options.retry_count > 0) {
        console.log(chalk.yellow(`  リトライ中... (${this.config.test_options.retry_count}回まで)`));
        // リトライロジック（簡略版）
      }
    }

    const endTime = Date.now();
    result.execution_time = Math.round((endTime - startTime) / 1000);
    
    // スクリーンショット撮影
    if (this.config.test_options.screenshot_enabled) {
      result.screenshot = await this.captureScreenshot(testCase.test_id, reportDir);
    }
    
    this.results.push(result);
  }

  shouldUseAICLI(testCase) {
    // AI CLIを使用するかどうかの判断ロジック
    // 複雑なテストケースや動的な要素がある場合はAI CLIを使用
    return testCase.test_steps.some(step => 
      step.action === 'ai_action' || 
      step.description.includes('AI') ||
      testCase.test_category === 'AI統合テスト'
    );
  }

  async executeWithAICLI(testCase, target, result) {
    // AI CLIを使用したテスト実行
    const cli = this.options.cli || this.config.ai_cli_settings.default_cli;
    const prompt = this.generateAIPrompt(testCase, target);
    
    try {
      const response = await this.cliManager.execute(cli, prompt);
      result.actual_result = response;
      
      // AI応答の解析
      if (response.includes('成功') || response.includes('完了')) {
        result.status = 'PASS';
      } else if (response.includes('失敗') || response.includes('エラー')) {
        result.status = 'FAIL';
        result.error = response;
      }
    } catch (error) {
      throw new Error(`AI CLI実行エラー: ${error.message}`);
    }
  }

  generateAIPrompt(testCase, target) {
    let prompt = `以下のWebサイトテストを実行してください。\n\n`;
    prompt += `URL: ${target.base_url}\n`;
    prompt += `テストケース: ${testCase.test_case_name}\n`;
    prompt += `前提条件: ${testCase.preconditions}\n\n`;
    prompt += `テストステップ:\n`;
    
    testCase.test_steps.forEach(step => {
      prompt += `${step.step_number}. ${step.description}\n`;
    });
    
    prompt += `\n期待結果: ${testCase.expected_result}\n`;
    prompt += `\n結果を「成功」または「失敗」で報告してください。`;
    
    return prompt;
  }

  async executeWithPlaywright(testCase, target, result, reportDir) {
    // テストケースにtarget_urlがある場合は最初にアクセス
    if (testCase.target_url) {
      const cleanUrl = testCase.target_url.replace(/\/+$/, '').replace(/\/+/g, '/').replace(':/', '://');
      this.logger.debug(`  初期URLアクセス: ${cleanUrl}`);
      await this.page.goto(cleanUrl);
    } else if (target.base_url) {
      // target_urlがない場合はtargetのbase_urlを使用
      const cleanUrl = target.base_url.replace(/\/+$/, '').replace(/\/+/g, '/').replace(':/', '://');
      this.logger.debug(`  初期URLアクセス: ${cleanUrl}`);
      await this.page.goto(cleanUrl);
    }
    
    // Playwrightで直接テスト実行
    for (const step of testCase.test_steps) {
      // 「ページにアクセスする」ステップはスキップ（既にアクセス済み）
      if (step.description === 'ページにアクセスする') {
        continue;
      }
      
      await this.executeStep(step, target);
      
      // ステップごとのスクリーンショット
      if (this.config.test_options.screenshot_enabled) {
        await this.captureStepScreenshot(testCase.test_id, step.step_number, reportDir);
      }
    }
  }

  async executeStep(step, target) {
    // ステップの詳細情報を表示
    console.log(chalk.cyan('\n─'.repeat(60)));
    console.log(chalk.bold.cyan(`👉 ステップ ${step.step_number}: ${step.description}`));
    
    // ステップ値の変数置換
    const processedStep = this.replaceVariables(step, target);
    
    // アクションと値の事前表示
    if (processedStep.action) {
      console.log(chalk.yellow(`  🎯 アクション: ${processedStep.action}`));
    }
    if (processedStep.target) {
      console.log(chalk.gray(`  🔍 対象要素: ${processedStep.target}`));
    }
    if (processedStep.value !== undefined && processedStep.value !== '') {
      // パスワードの場合はマスク
      const displayValue = processedStep.target?.includes('password') || step.description?.includes('パスワード')
        ? '*'.repeat(processedStep.value.length)
        : processedStep.value;
      console.log(chalk.green(`  📝 入力値: 「${displayValue}」`));
    }
    
    this.logger.debug(`  ステップ ${step.step_number}: ${step.description}`);
    
    switch (processedStep.action) {
      case 'goto':
        await this.page.goto(processedStep.target);
        break;
        
      case 'click':
        console.log(chalk.gray(`  🕹️  クリック実行中...`));
        await this.page.click(processedStep.target);
        console.log(chalk.green(`  ✅ クリック完了`));
        break;
        
      case 'fill':
        // オートコンプリートを無効化してフィールドをクリアしてから入力
        try {
          console.log(chalk.gray('  🧹 フィールドをクリア中...'));
          // まずフィールドをクリア（3回クリックで全選択）
          await this.page.click(processedStep.target, { clickCount: 3 });
          await this.page.keyboard.press('Backspace');
          
          console.log(chalk.gray(`  ⌨️  入力中: 「${processedStep.value}」`));
          // fillの代わりにtypeを使用（より確実な入力）
          await this.page.type(processedStep.target, processedStep.value, { delay: 50 });
          
          // 入力後の値を確認
          const actualValue = await this.page.inputValue(processedStep.target).catch(() => null);
          if (actualValue !== null) {
            if (actualValue === processedStep.value) {
              console.log(chalk.green(`  ✅ 入力成功: 「${actualValue}」`));
            } else {
              console.log(chalk.yellow(`  ⚠️  入力値が異なる: 期待「${processedStep.value}」 実際「${actualValue}」`));
            }
          }
        } catch (error) {
          // フォールバック：通常のfillメソッド
          console.log(chalk.yellow('⚠️  標準入力方法にフォールバック'));
          await this.page.fill(processedStep.target, processedStep.value);
        }
        break;
        
      case 'selectOption':
        console.log(chalk.gray(`  📂 選択中: 「${processedStep.value}」`));
        await this.page.selectOption(processedStep.target, processedStep.value);
        const selectedValue = await this.page.inputValue(processedStep.target);
        console.log(chalk.green(`  ✅ 選択完了: 「${selectedValue}」`));
        break;
        
      case 'check':
        console.log(chalk.gray(`  ☑️  チェックを付ける...`));
        await this.page.check(processedStep.target);
        const isChecked = await this.page.isChecked(processedStep.target);
        console.log(isChecked ? chalk.green(`  ✅ チェック済み`) : chalk.yellow(`  ⚠️  チェックできませんでした`));
        break;
        
      case 'uncheck':
        console.log(chalk.gray(`  ☐️  チェックを外す...`));
        await this.page.uncheck(processedStep.target);
        const isUnchecked = !(await this.page.isChecked(processedStep.target));
        console.log(isUnchecked ? chalk.green(`  ✅ チェック解除`) : chalk.yellow(`  ⚠️  チェック解除できませんでした`));
        break;
        
      case 'wait':
        await this.page.waitForTimeout(parseInt(processedStep.value) || 1000);
        break;
        
      case 'waitForSelector':
        await this.page.waitForSelector(processedStep.target);
        break;
        
      case 'press':
        await this.page.press(processedStep.target, processedStep.value);
        break;
        
      case 'screenshot':
        await this.page.screenshot({ path: processedStep.value });
        break;
        
      case 'manual':
        // 手動ステップをAI CLIで自動実行
        await this.executeManualStep(processedStep, target);
        break;
        
      default:
        this.logger.warn(`未知のアクション: ${processedStep.action}`);
    }
  }
  
  replaceVariables(step, target) {
    const processedStep = { ...step };
    
    // URLの置換
    if (processedStep.target) {
      processedStep.target = processedStep.target
        .replace('${base_url}', target.base_url)
        .replace('${admin_url}', target.admin_url);
    }
    
    // 値の置換（ログイン情報など）
    if (processedStep.value) {
      processedStep.value = processedStep.value
        .replace('${user.email}', target.login_credentials?.user?.email || '')
        .replace('${user.password}', target.login_credentials?.user?.password || '')
        .replace('${admin.email}', target.login_credentials?.admin?.email || '')
        .replace('${admin.password}', target.login_credentials?.admin?.password || '');
    }
    
    // 説明文の中の変数も置換
    if (processedStep.description) {
      processedStep.description = processedStep.description
        .replace(/testuser/gi, target.login_credentials?.user?.email || 'testuser')
        .replace(/password123/gi, target.login_credentials?.user?.password || 'password123');
    }
    
    return processedStep;
  }
  
  async executeManualStep(step, target) {
    const description = step.description.toLowerCase();
    
    // スキップ条件: "**"のみの場合、または「ページにアクセスする」の場合
    if (step.description.trim() === '**' || step.description === 'ページにアクセスする') {
      return;
    }
    
    // URLアクセス（既に初期アクセス済みの場合はスキップ）
    if (description.includes('開く') || description.includes('アクセス')) {
      const urlMatch = description.match(/https?:\/\/[^\s`'"]+/);
      if (urlMatch) {
        let url = urlMatch[0].replace(/[`'"]/g, '').replace(/。$/, '').replace(/\/+$/, '');
        // 重複スラッシュを修正
        url = url.replace(/\/+/g, '/').replace(':/', '://');
        // example.comの場合は設定のURLに置き換え
        if (url.includes('example.com')) {
          url = target.base_url.replace(/\/+$/, '').replace(/\/+/g, '/').replace(':/', '://');
        }
        await this.page.goto(url);
        return;
      }
    }
    
    // ユーザー名/メール入力
    if (description.includes('ユーザー名') || description.includes('email') || description.includes('user') || description.includes('メール')) {
      const email = target.login_credentials?.user?.email;
      console.log(chalk.yellow(`📧 ユーザー名/メール入力処理開始`));
      console.log(chalk.gray(`  設定値: ${email || '未設定'}`));
      
      if (email) {
        this.logger.debug(`  ユーザー名入力: ${email}`);
        try {
          // 複数のセレクタを試行
          const selectors = [
            'input[type="email"]',
            'input[type="text"][name*="email"]',
            'input[type="text"][name*="user"]',
            'input[name*="email"]',
            'input[name*="user"]',
            'input[placeholder*="email" i]',
            'input[placeholder*="user" i]',
            '#email',
            '#username',
            '#user'
          ];
          
          for (const selector of selectors) {
            const element = await this.page.locator(selector).first();
            if (await element.isVisible()) {
              // fillの代わりにクリア→タイプの手順を使用
              await element.click();
              await element.click({ clickCount: 3 }); // 全選択
              await this.page.keyboard.press('Backspace');
              await element.type(email, { delay: 50 });
              this.logger.debug(`  ユーザー名を入力しました（セレクタ: ${selector}）`);
              return;
            }
          }
          
          // どれも見つからない場合は最初の text input を試す
          const firstTextInput = await this.page.locator('input[type="text"]').first();
          await firstTextInput.click();
          await firstTextInput.click({ clickCount: 3 });
          await this.page.keyboard.press('Backspace');
          await firstTextInput.type(email, { delay: 50 });
        } catch (error) {
          this.logger.warn(`  ユーザー名入力フィールドが見つかりません: ${error.message}`);
        }
        return;
      }
    }
    
    // パスワード入力
    if (description.includes('パスワード') || description.includes('password')) {
      const password = target.login_credentials?.user?.password;
      console.log(chalk.yellow(`🔐 パスワード入力処理開始`));
      console.log(chalk.gray(`  設定パスワード: ${password ? '*'.repeat(password.length) : '未設定'}`));
      
      if (password) {
        this.logger.debug(`  パスワード入力: ${'*'.repeat(password.length)}`);
        try {
          const selectors = [
            'input[type="password"]',
            'input[name*="pass" i]',
            'input[id*="pass" i]',
            '#password',
            '#pass',
            '[type="password"]'
          ];
          
          console.log(chalk.gray(`  試行セレクタ数: ${selectors.length}`));
          
          for (const selector of selectors) {
            try {
              const element = await this.page.locator(selector).first();
              const count = await this.page.locator(selector).count();
              console.log(chalk.gray(`  セレクタ ${selector}: ${count}個の要素`));
              
              if (await element.isVisible()) {
                console.log(chalk.green(`  ✅ 有効なセレクタ: ${selector}`));
                // fillの代わりにクリア→タイプの手順を使用
                await element.click();
                await this.page.waitForTimeout(100); // 少し待機
                await element.click({ clickCount: 3 }); // 全選択
                await this.page.keyboard.press('Backspace');
                await this.page.waitForTimeout(100); // 少し待機
                await element.type(password, { delay: 50 });
                this.logger.debug(`  パスワードを入力しました（セレクタ: ${selector}）`);
                console.log(chalk.green(`  ✅ パスワード入力完了`));
                return;
              }
            } catch (innerError) {
              console.log(chalk.gray(`  セレクタ ${selector} エラー: ${innerError.message}`));
            }
          }
          console.log(chalk.red(`  ❌ パスワードフィールドが見つかりません`));
        } catch (error) {
          this.logger.warn(`  パスワード入力フィールドが見つかりません: ${error.message}`);
        }
        return;
      } else {
        console.log(chalk.yellow(`  ⚠️ パスワードが設定されていません`));
      }
    }
    
    // ボタンクリック
    if (description.includes('クリック')) {
      const buttonMatch = description.match(/「([^」]+)」/);
      if (buttonMatch) {
        const buttonText = buttonMatch[1];
        this.logger.debug(`  ボタンクリック: ${buttonText}`);
        
        const selectors = [
          `button:has-text("${buttonText}")`,
          `input[type="submit"][value="${buttonText}"]`,
          `input[type="button"][value="${buttonText}"]`,
          `a:has-text("${buttonText}")`,
          `[role="button"]:has-text("${buttonText}")`,
          `button:has-text("${buttonText.toLowerCase()}")`,
          `button:has-text("${buttonText.toUpperCase()}")`,
          // 英語版も試す
          buttonText === 'ログイン' ? 'button:has-text("Login")' : null,
          buttonText === 'ログイン' ? 'button:has-text("Sign in")' : null,
          buttonText === 'ログイン' ? 'input[type="submit"][value="Login"]' : null,
          buttonText === 'ログイン' ? 'input[type="submit"][value="Sign in"]' : null,
        ].filter(s => s);
        
        for (const selector of selectors) {
          try {
            const element = await this.page.locator(selector).first();
            if (await element.isVisible()) {
              await element.click();
              return;
            }
          } catch {
            // 次のセレクタを試す
          }
        }
        
        // 最後の手段: type=submitのボタンをクリック
        try {
          await this.page.locator('input[type="submit"], button[type="submit"]').first().click();
        } catch (error) {
          this.logger.warn(`  ボタンが見つかりません: ${buttonText}`);
        }
        return;
      }
    }
    
    // それ以外は警告のみ
    this.logger.debug(`  手動ステップをスキップ: ${step.description}`);
  }

  async executeAssertion(assertion, result) {
    try {
      switch (assertion.type) {
        case 'url_contains':
          const url = this.page.url();
          if (!url.includes(assertion.value)) {
            throw new Error(`URLアサーション失敗: "${assertion.value}" が含まれていません (実際: ${url})`);
          }
          break;
          
        case 'text_visible':
          const textLocator = this.page.locator(`text=${assertion.value}`);
          const isVisible = await textLocator.isVisible();
          if (!isVisible) {
            throw new Error(`テキストアサーション失敗: "${assertion.value}" が表示されていません`);
          }
          break;
          
        case 'element_exists':
          const elementLocator = this.page.locator(assertion.value);
          const exists = await elementLocator.count() > 0;
          if (!exists) {
            throw new Error(`要素アサーション失敗: "${assertion.value}" が存在しません`);
          }
          break;
          
        case 'title_contains':
          const title = await this.page.title();
          if (!title.includes(assertion.value)) {
            throw new Error(`タイトルアサーション失敗: "${assertion.value}" が含まれていません (実際: ${title})`);
          }
          break;
      }
    } catch (error) {
      result.error = error.message;
      throw error;
    }
  }

  async captureScreenshot(testId, reportDir) {
    const screenshotDir = path.join(reportDir, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const filename = `${testId}_${Date.now()}.png`;
    const filepath = path.join(screenshotDir, filename);
    
    try {
      await this.page.screenshot({
        path: filepath,
        fullPage: true
      });
      return `screenshots/${filename}`;
    } catch (error) {
      this.logger.error('スクリーンショット撮影エラー:', error.message);
      return null;
    }
  }

  async captureStepScreenshot(testId, stepNumber, reportDir) {
    const screenshotDir = path.join(reportDir, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const filename = `${testId}_step${stepNumber}.png`;
    const filepath = path.join(screenshotDir, filename);
    
    try {
      await this.page.screenshot({
        path: filepath,
        fullPage: false
      });
      this.logger.debug(`    📸 スクリーンショット: ${filename}`);
    } catch (error) {
      this.logger.error('ステップスクリーンショット撮影エラー:', error.message);
    }
  }

  showResultsSummary(totalTime) {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const errors = this.results.filter(r => r.status === 'ERROR').length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    console.log(chalk.cyan('\n📊 実行結果サマリー'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`ブラウザ: ${this.browserType.toUpperCase()}`);
    console.log(`実行時間: ${totalTime}秒`);
    console.log(`総テスト数: ${total}`);
    console.log(`${chalk.green('成功')}: ${passed}`);
    console.log(`${chalk.red('失敗')}: ${failed}`);
    console.log(`${chalk.yellow('エラー')}: ${errors}`);
    console.log(`成功率: ${passRate}%`);
    
    // カテゴリ別サマリー
    const categories = {};
    this.results.forEach(result => {
      if (!categories[result.test_category]) {
        categories[result.test_category] = { total: 0, passed: 0 };
      }
      categories[result.test_category].total++;
      if (result.status === 'PASS') {
        categories[result.test_category].passed++;
      }
    });

    console.log('\nカテゴリ別結果:');
    Object.entries(categories).forEach(([category, stats]) => {
      const categoryPassRate = Math.round((stats.passed / stats.total) * 100);
      const color = categoryPassRate === 100 ? chalk.green :
                   categoryPassRate >= 80 ? chalk.yellow :
                   chalk.red;
      console.log(`  ${category}: ${stats.passed}/${stats.total} (${color(categoryPassRate + '%')})`);
    });
    
    console.log(chalk.gray('─'.repeat(40)));
  }

  async generateReports(reportDir) {
    console.log(chalk.cyan('\n📝 レポート生成中...'));

    // テストシート生成
    const sheetGenerator = new TestSheetGenerator(this.config);
    await sheetGenerator.generateTestSheet(this.results, reportDir);

    // HTMLレポート生成
    if (this.config.output_settings.formats.includes('html')) {
      await this.generateHTMLReport(reportDir);
    }

    // トレースファイルは既にfinally句で保存済み
    // ここでは何もしない（二重停止を防ぐ）
  }

  async generateHTMLReport(reportDir) {
    const htmlPath = path.join(reportDir, 'report.html');
    const title = this.config.output_settings.report_title;
    
    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .stat-card { flex: 1; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-card.pass { background: #d4edda; color: #155724; }
        .stat-card.fail { background: #f8d7da; color: #721c24; }
        .stat-card.total { background: #d1ecf1; color: #0c5460; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; font-weight: 600; }
        tr:hover { background: #f8f9fa; }
        .pass { color: #28a745; font-weight: bold; }
        .fail { color: #dc3545; font-weight: bold; }
        .error { color: #ffc107; font-weight: bold; }
        .screenshot { color: #007bff; cursor: pointer; text-decoration: underline; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        <p>実行日時: ${new Date().toLocaleString('ja-JP')}</p>
        
        <div class="summary">
            <div class="stat-card total">
                <h2>${this.results.length}</h2>
                <p>総テスト数</p>
            </div>
            <div class="stat-card pass">
                <h2>${this.results.filter(r => r.status === 'PASS').length}</h2>
                <p>成功</p>
            </div>
            <div class="stat-card fail">
                <h2>${this.results.filter(r => r.status === 'FAIL').length}</h2>
                <p>失敗</p>
            </div>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>テストID</th>
                    <th>テスト名</th>
                    <th>カテゴリ</th>
                    <th>優先度</th>
                    <th>結果</th>
                    <th>実行時間</th>
                    <th>エラー</th>
                    <th>スクリーンショット</th>
                </tr>
            </thead>
            <tbody>
                ${this.results.map(r => `
                <tr>
                    <td>${r.test_id}</td>
                    <td>${r.test_name}</td>
                    <td>${r.test_category}</td>
                    <td>${r.priority}</td>
                    <td class="${r.status.toLowerCase()}">${r.status}</td>
                    <td>${r.execution_time}秒</td>
                    <td>${r.error || '-'}</td>
                    <td>${r.screenshot ? `<span class="screenshot" onclick="window.open('${r.screenshot}')">表示</span>` : '-'}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="footer">
            <p>WebTestAI - AI-Powered Web Testing Framework</p>
        </div>
    </div>
</body>
</html>`;

    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log(chalk.green('✅ HTMLレポート生成: report.html'));
  }
}

export default TestRunner;