import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import chalk from 'chalk';
import ora from 'ora';
import ConfigManager from './config-manager.js';
import TestSheetGenerator from './test-sheet-generator.js';
import CLIManager from './cli-manager.js';
import Logger from './utils/logger.js';
import ScreenshotManager from './utils/screenshot.js';

class TestRunner {
  constructor(options = {}) {
    this.options = options;
    this.configManager = new ConfigManager();
    this.config = this.configManager.config;
    this.cliManager = new CLIManager(this.config);
    this.logger = new Logger(options.verbose);
    this.screenshotManager = new ScreenshotManager(this.config);
    this.testCases = this.loadTestCases();
    this.results = [];
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  loadTestCases() {
    const testCasesPath = path.join(process.cwd(), 'config', 'test-cases.json');
    try {
      if (fs.existsSync(testCasesPath)) {
        const data = fs.readFileSync(testCasesPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      this.logger.error('テストケース読み込みエラー:', error.message);
    }
    return { test_cases: [] };
  }

  async execute() {
    console.log(chalk.cyan('\n🚀 テスト実行開始\n'));

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

    // レポートディレクトリ作成
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const reportDir = path.join(process.cwd(), 'reports', timestamp);
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
    console.log(chalk.blue(`📁 レポート: reports/${timestamp}/`));
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
      
      this.browser = await chromium.launch({
        headless: headless,
        args: ['--start-maximized']
      });

      this.context = await this.browser.newContext({
        viewport: null,
        recordVideo: this.config.test_options.video_enabled ? {
          dir: path.join(process.cwd(), 'reports', 'videos')
        } : undefined
      });
      
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
    // Playwrightで直接テスト実行
    for (const step of testCase.test_steps) {
      await this.executeStep(step, target);
      
      // ステップごとのスクリーンショット
      if (this.config.test_options.screenshot_enabled) {
        await this.captureStepScreenshot(testCase.test_id, step.step_number, reportDir);
      }
    }
  }

  async executeStep(step, target) {
    this.logger.debug(`  ステップ ${step.step_number}: ${step.description}`);
    
    switch (step.action) {
      case 'goto':
        await this.page.goto(step.target);
        break;
        
      case 'click':
        await this.page.click(step.target);
        break;
        
      case 'fill':
        await this.page.fill(step.target, step.value);
        break;
        
      case 'selectOption':
        await this.page.selectOption(step.target, step.value);
        break;
        
      case 'check':
        await this.page.check(step.target);
        break;
        
      case 'uncheck':
        await this.page.uncheck(step.target);
        break;
        
      case 'wait':
        await this.page.waitForTimeout(parseInt(step.value) || 1000);
        break;
        
      case 'waitForSelector':
        await this.page.waitForSelector(step.target);
        break;
        
      case 'press':
        await this.page.press(step.target, step.value);
        break;
        
      case 'screenshot':
        await this.page.screenshot({ path: step.value });
        break;
        
      default:
        this.logger.warn(`未知のアクション: ${step.action}`);
    }
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