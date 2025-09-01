import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import ConfigManager from './config-manager.js';
import CLIManager from './cli-manager.js';
import TestCaseManager from './test-case-manager.js';
import { TEST_GENERATION_PROMPT, TEST_DATA, SECURITY_TEST_TEMPLATES } from './ai-test-prompts.js';
import { ComprehensiveTestGenerator } from './comprehensive-test-generator.js';
import { VisualElementCollector } from './visual-element-collector.js';
import { EnhancedElementCollector } from './enhanced-element-collector.js';
import { CompleteHTMLCollector } from './complete-html-collector.js';
import { ECCubeAnalyzer } from './eccube-analyzer.js';

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

class TestCaseAutoGenerator {
  constructor(options = {}) {
    this.options = options;
    this.configManager = new ConfigManager();
    this.config = this.configManager.config;
    this.cliManager = new CLIManager(this.config);
    this.testCasesPath = path.join(process.cwd(), 'config', 'test-cases.json');
    // 自動生成時は新規作成するため、空の状態で初期化
    this.testCases = {
      test_cases: [],
      last_updated: this.getJSTTimestamp(),
      version: '1.0.0'
    };
  }

  /**
   * 日本時間（JST）でISO文字列を生成
   */
  getJSTTimestamp() {
    const now = new Date();
    // JSTは UTC+9
    const jstOffset = 9 * 60; // 9時間を分に変換
    const localOffset = now.getTimezoneOffset(); // ローカルタイムゾーンのオフセット（分）
    const jstTime = new Date(now.getTime() + (jstOffset + localOffset) * 60 * 1000);
    
    // ISO形式に近い形式でJST表記を追加
    const year = jstTime.getFullYear();
    const month = String(jstTime.getMonth() + 1).padStart(2, '0');
    const day = String(jstTime.getDate()).padStart(2, '0');
    const hours = String(jstTime.getHours()).padStart(2, '0');
    const minutes = String(jstTime.getMinutes()).padStart(2, '0');
    const seconds = String(jstTime.getSeconds()).padStart(2, '0');
    const milliseconds = String(jstTime.getMilliseconds()).padStart(3, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}+09:00`;
  }

  loadTestCases() {
    try {
      if (fs.existsSync(this.testCasesPath)) {
        const data = fs.readFileSync(this.testCasesPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(chalk.red('テストケース読み込みエラー:'), error.message);
    }
    
    return {
      test_cases: [],
      last_updated: this.getJSTTimestamp(),
      version: '1.0.0'
    };
  }

  async analyzePageWithAI(url, options = {}) {
    console.log(chalk.cyan('\n🤖 AI駆動ページ解析開始\n'));
    
    const spinner = ora('ページを解析中...').start();
    
    let browser, context, page;
    let shouldCloseBrowser = true;
    
    try {
      // 既存のブラウザコンテキストを使用するか新規作成するか
      if (options.existingPage) {
        // 既存のページを使用（ログイン状態維持）
        page = options.existingPage;
        shouldCloseBrowser = false;
        console.log(chalk.yellow('ℹ️  既存のブラウザコンテキストを使用（ログイン状態維持）'));
      } else {
        // 新規ブラウザ起動
        const defaultArgs = ['--lang=ja-JP', '--font-render-hinting=none'];
        const configArgs = playwrightConfig?.use?.launchOptions?.args || [];
        
        browser = await chromium.launch({
          headless: this.options.headless !== false,
          args: [...new Set([...defaultArgs, ...configArgs])],
          ...(playwrightConfig?.use?.launchOptions || {})
        });
        
        // コンテキスト設定を統合
        context = await browser.newContext({
          locale: playwrightConfig?.use?.locale || 'ja-JP',
          timezoneId: playwrightConfig?.use?.timezoneId || 'Asia/Tokyo',
          ...(playwrightConfig?.use?.contextOptions || {})
        });
        page = await context.newPage();
        
        // タイムアウトを延長
        page.setDefaultTimeout(60000);
        page.setDefaultNavigationTimeout(60000);
      }
      
      // ページにアクセス（既存ページの場合は現在のURLを使用）
      if (options.existingPage) {
        // 既存ページの場合は現在のURLを取得
        const currentUrl = page.url();
        spinner.text = `現在のページを解析中: ${currentUrl}`;
        console.log(chalk.gray(`現在のURL: ${currentUrl}`));
        // url変数を現在のURLに更新
        url = currentUrl;
      } else {
        spinner.text = `${url} にアクセス中...`;
        try {
          await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
          });
          await page.waitForTimeout(2000); // 追加の待機
        } catch (error) {
          if (error.name === 'TimeoutError') {
            console.log(chalk.yellow('\n⚠️  ページの読み込みに時間がかかりましたが、解析を続行します'));
          } else {
            throw error;
          }
        }
      }
      
      // EC-CUBE解析
      const eccubeAnalyzer = new ECCubeAnalyzer();
      const pageType = await eccubeAnalyzer.detectPageType(page);
      let eccubeTestCases = [];

      if (pageType && pageType !== 'unknown') {
        spinner.text = 'EC-CUBE特有の要素を解析中...';
        console.log(chalk.magenta('\n✨ EC-CUBEサイトを検出！専用解析を実行します。'));
        const eccubeAnalysis = await eccubeAnalyzer.analyzePage(page);
        
        spinner.text = 'EC-CUBE専用テストシナリオを生成中...';
        const eccubeScenarios = eccubeAnalyzer.generateECCubeTestScenarios(pageType, eccubeAnalysis.elements);
        
        // シナリオを具体的なテストケースに変換
        eccubeTestCases = eccubeScenarios.map(scenario => ({
          name: `[EC-CUBE] ${scenario.name}`,
          category: 'EC-CUBE',
          priority: 'High',
          steps: scenario.steps,
          expectedResult: 'EC-CUBEの機能が正しく動作すること',
          target_url: url
        }));
        console.log(chalk.magenta(`  ✅ ${eccubeTestCases.length}個のEC-CUBE専用テストケースを生成`));
      }

      // ページ情報を収集
      spinner.text = 'ページ要素を分析中...';
      const pageInfo = await this.collectPageInfo(page);
      // URLを明示的に更新（セッション維持の場合、現在のURLを使用）
      pageInfo.url = url;
      
      // 完全版HTML要素収集（すべてのHTMLタグに対応）
      spinner.text = 'すべてのHTML要素を完全解析中...';
      const completeCollector = new CompleteHTMLCollector();
      const completeElements = await completeCollector.collectAllHTMLElements(page);
      
      // 統計情報を表示
      if (completeElements.stats) {
        console.log(chalk.cyan('\n📊 完全版HTML要素解析統計:'));
        console.log(chalk.gray(`  • 総要素数: ${completeElements.stats.totalElements}個`));
        console.log(chalk.gray(`  • 可視要素: ${completeElements.stats.visibleElements}個`));
        console.log(chalk.gray(`  • インタラクティブ要素: ${completeElements.stats.interactiveElements}個`));
        console.log(chalk.gray(`  • フォーム要素: ${completeElements.stats.formElements}個`));
        console.log(chalk.gray(`  • Shadow DOM: ${completeElements.stats.shadowDOMs}個`));
        console.log(chalk.gray(`  • カスタム要素: ${completeElements.stats.customElements}個`));
      }
      
      // 強化版要素収集（Shadow DOM、iframe、動的コンテンツ対応）も併用
      spinner.text = '包括的な要素解析を実行中...';
      const enhancedCollector = new EnhancedElementCollector();
      const allElements = await enhancedCollector.collectAllElements(page);
      
      console.log(chalk.cyan('\n🔍 強化版解析で検出された要素:'));
      const elementStats = {
        'リンク': allElements.links?.length || 0,
        'ボタン': allElements.buttons?.length || 0,
        '入力フィールド': allElements.inputs?.length || 0,
        'フォーム': allElements.forms?.length || 0,
        'セレクトボックス': allElements.selects?.length || 0,
        'チェックボックス': allElements.checkboxes?.length || 0,
        'ラジオボタン': allElements.radios?.length || 0,
        'ドロップダウン': allElements.dropdowns?.length || 0,
        'タブ': allElements.tabs?.length || 0,
        'モーダル': allElements.modals?.length || 0,
        'アコーディオン': allElements.accordions?.length || 0,
        'Shadow DOM': allElements.shadowRoots?.length || 0,
        'Web Components': allElements.webComponents?.length || 0
      };
      
      Object.entries(elementStats).forEach(([key, value]) => {
        if (value > 0) {
          console.log(chalk.gray(`  • ${key}: ${value}個`));
        }
      });
      
      // 画面に表示されている要素のみを収集（従来版も併用）
      spinner.text = '画面の可視要素を分析中...';
      const visualCollector = new VisualElementCollector();
      const visibleElements = await visualCollector.collectAllVisibleElements(page);
      
      console.log(chalk.cyan('\n📊 可視要素の解析結果:'));
      console.log(chalk.gray(`  • リンク: ${visibleElements.links.length}個`));
      console.log(chalk.gray(`  • ボタン: ${visibleElements.buttons.length}個`));
      console.log(chalk.gray(`  • 入力フィールド: ${visibleElements.inputs.length}個`));
      console.log(chalk.gray(`  • チェックボックス: ${visibleElements.checkboxes.length}個`));
      console.log(chalk.gray(`  • ラジオボタン: ${visibleElements.radios.length}個`));
      console.log(chalk.gray(`  • セレクトボックス: ${visibleElements.selects.length}個`));
      console.log(chalk.gray(`  • タブ: ${visibleElements.tabs?.length || 0}個`));
      console.log(chalk.gray(`  • アコーディオン: ${visibleElements.accordions?.length || 0}個`));
      console.log(chalk.gray(`  • フォーム: ${visibleElements.forms.length}個`));
      console.log(chalk.gray(`  • ナビゲーション: ${visibleElements.navigationItems.length}個`));
      console.log(chalk.gray(`  • フッターリンク: ${visibleElements.footerLinks.length}個\n`));
      
      // 包括的なページ解析も実行
      spinner.text = '包括的なテスト要素を分析中...';
      const comprehensiveGen = new ComprehensiveTestGenerator();
      const comprehensiveAnalysis = await comprehensiveGen.analyzePageComprehensive(page, url);
      
      // スクリーンショット撮影
      const screenshotPath = await this.captureScreenshot(page, 'page-analysis');
      pageInfo.screenshot = screenshotPath;
      comprehensiveAnalysis.screenshot = screenshotPath;
      
      spinner.succeed('ページ解析完了');
      
      // AI CLIでテストケース提案を生成
      console.log(chalk.cyan('\n🧠 AI CLIでテストケースを生成中...\n'));
      const aiTestSuggestions = await this.generateTestSuggestionsWithAI(pageInfo);
      // 各テストケースにtarget_urlを明示的に設定
      aiTestSuggestions.forEach(tc => { tc.target_url = url; });
      
      // 完全版HTML要素からテストケースを生成（最高優先）
      console.log(chalk.cyan('🌐 完全版HTML解析でテストケースを生成中...\n'));
      const completeTestCases = completeCollector.generateTestCasesFromElements(completeElements, url);
      // 各テストケースにtarget_urlを明示的に設定
      completeTestCases.forEach(tc => { tc.target_url = url; });
      console.log(chalk.green(`  ✅ ${completeTestCases.length}個の完全版テストケースを生成`));
      
      // 強化版要素からテストケースを生成（優先）
      console.log(chalk.cyan('🚀 強化版解析でテストケースを生成中...\n'));
      const enhancedTestCases = enhancedCollector.generateTestCasesFromElements(allElements, url);
      // 各テストケースにtarget_urlを明示的に設定
      enhancedTestCases.forEach(tc => { tc.target_url = url; });
      console.log(chalk.green(`  ✅ ${enhancedTestCases.length}個の強化版テストケースを生成`));
      
      // 可視要素からテストケースを生成（互換性維持）
      console.log(chalk.cyan('👁️ 可視要素からテストケースを生成中...\n'));
      const visualTestCases = visualCollector.generateTestCasesFromVisibleElements(visibleElements, url);
      // 各テストケースにtarget_urlを明示的に設定
      visualTestCases.forEach(tc => { tc.target_url = url; });
      console.log(chalk.green(`  ✅ ${visualTestCases.length}個の可視要素テストケースを生成`));
      
      // 包括的なテストケースも生成
      console.log(chalk.cyan('🔍 包括的なテストケースを生成中...\n'));
      const comprehensiveTestCases = comprehensiveGen.generateComprehensiveTestCases(comprehensiveAnalysis);
      // 各テストケースにtarget_urlを明示的に設定
      comprehensiveTestCases.forEach(tc => { tc.target_url = url; });
      
      // テストケースを統合（重複を避ける）
      const testSuggestions = [
        ...eccubeTestCases, // EC-CUBEテストを最優先
        ...completeTestCases.slice(0, 50), // 完全版テストを最高優先（最大50件）
        ...enhancedTestCases.slice(0, 30), // 強化版テストを優先（最大30件）
        ...visualTestCases.slice(0, 20), // 可視要素テストを優先（最大20件）
        ...comprehensiveTestCases.slice(0, 15), // 包括的テストから最大15件
        ...aiTestSuggestions.slice(0, 5) // AIテストから最大5件
      ];
      
      // セキュリティ解析結果を追加
      console.log(chalk.yellow('\n🔒 セキュリティ解析結果:'));
      if (comprehensiveAnalysis.security) {
        console.log(`  CSRFトークン: ${comprehensiveAnalysis.security.hasCSRFToken ? '✅ あり' : '⚠️ なし'}`);
        console.log(`  パスワードフィールド: ${comprehensiveAnalysis.security.authentication.hasPasswordField ? '✅ あり' : '❌ なし'}`);
        console.log(`  入力検証フィールド: ${comprehensiveAnalysis.security.inputValidation.fieldsWithPattern}個`);
      }
      
      // ブラウザを閉じる（新規作成した場合のみ）
      if (shouldCloseBrowser && browser) {
        await browser.close();
      }
      
      return {
        pageInfo,
        comprehensiveAnalysis,
        testSuggestions
      };
      
    } catch (error) {
      spinner.fail('ページ解析エラー');
      console.error(chalk.red('エラー:'), error.message);
      throw error;
    }
  }

  async collectPageInfo(page) {
    const pageInfo = {
      url: page.url(),
      title: await page.title(),
      elements: {}
    };

    // フォーム要素の検出
    pageInfo.elements.forms = await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form'));
      return forms.map(form => ({
        id: form.id,
        name: form.name,
        action: form.action,
        method: form.method,
        inputs: Array.from(form.querySelectorAll('input, select, textarea')).map(input => ({
          type: input.type || input.tagName.toLowerCase(),
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          required: input.required,
          value: input.value,
          selector: input.id ? `#${input.id}` : 
                   input.name ? `[name="${input.name}"]` : 
                   `${input.tagName.toLowerCase()}[type="${input.type}"]`
        }))
      }));
    });

    // ボタンの検出
    pageInfo.elements.buttons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, a.button'));
      return buttons.map(button => ({
        text: button.textContent?.trim() || button.value || '',
        type: button.type || 'button',
        id: button.id,
        className: button.className,
        selector: button.id ? `#${button.id}` :
                 button.className ? `.${button.className.split(' ')[0]}` :
                 `button:has-text("${button.textContent?.trim()}")`
      }));
    });

    // リンクの検出
    pageInfo.elements.links = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      return links.slice(0, 20).map(link => ({
        text: link.textContent?.trim() || '',
        href: link.href,
        id: link.id,
        className: link.className,
        selector: link.id ? `#${link.id}` :
                 `a:has-text("${link.textContent?.trim()}")`
      }));
    });

    // 入力フィールドの検出
    pageInfo.elements.inputs = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select'));
      return inputs.map(input => ({
        type: input.type || input.tagName.toLowerCase(),
        name: input.name,
        id: input.id,
        placeholder: input.placeholder,
        required: input.required,
        label: input.labels?.[0]?.textContent || '',
        selector: input.id ? `#${input.id}` : 
                 input.name ? `[name="${input.name}"]` : 
                 `${input.tagName.toLowerCase()}`
      }));
    });

    // テキストコンテンツの検出
    pageInfo.elements.headings = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3'));
      return headings.slice(0, 10).map(h => ({
        level: h.tagName,
        text: h.textContent?.trim() || ''
      }));
    });

    return pageInfo;
  }

  async generateTestSuggestionsWithAI(pageInfo) {
    const cli = this.config.ai_cli_settings.default_cli || 'gemini';
    
    // ページ情報からプロンプトを構築
    const prompt = this.buildAIPrompt(pageInfo);
    
    try {
      console.log(chalk.blue(`📡 ${cli} CLIでテストケース生成中...`));
      
      // AI CLIを実行
      const response = await this.cliManager.execute(cli, prompt, {
        temperature: 0.7,
        maxTokens: 2000
      });
      
      // レスポンスをパース
      const testCases = this.parseAIResponse(response, pageInfo);
      
      return testCases;
      
    } catch (error) {
      console.error(chalk.red('AI CLI実行エラー:'), error.message);
      
      // フォールバック: ルールベースでテストケース生成
      return this.generateFallbackTestCases(pageInfo);
    }
  }

  buildAIPrompt(pageInfo) {
    const credentials = this.config.test_targets?.[0]?.login_credentials;
    const userEmail = credentials?.user?.email || 'test@example.com';
    const userPassword = credentials?.user?.password || 'password123';
    
    // 詳細なプロンプトを使用
    let prompt = TEST_GENERATION_PROMPT + `\n\n【解析対象ページ情報】\n`;
    prompt += `URL: ${pageInfo.url}\n`;
    prompt += `タイトル: ${pageInfo.title}\n
重要な指示:
- URLアクセスのステップには必ず「${pageInfo.url}」を使用してください
- example.comやダミーURLは使用しないでください
- 実際のテスト対象URLを使用してください
- 正常系のログインテストでは以下の認証情報を使用してください：
  - ユーザー名: ${userEmail}
  - パスワード: ${userPassword}
- エラー系のテストでは無効な値（invalid_user, wrong_password）を使用してください

ページ要素:
`;

    // フォーム情報
    if (pageInfo.elements.forms?.length > 0) {
      prompt += '\n【フォーム】\n';
      pageInfo.elements.forms.forEach((form, index) => {
        prompt += `フォーム${index + 1}:\n`;
        form.inputs.forEach(input => {
          prompt += `  - ${input.type}: ${input.name || input.id} ${input.required ? '(必須)' : ''}\n`;
        });
      });
    }

    // ボタン情報
    if (pageInfo.elements.buttons?.length > 0) {
      prompt += '\n【ボタン】\n';
      pageInfo.elements.buttons.slice(0, 10).forEach(button => {
        prompt += `  - "${button.text}" (${button.type})\n`;
      });
    }

    // リンク情報
    if (pageInfo.elements.links?.length > 0) {
      prompt += '\n【主要リンク】\n';
      pageInfo.elements.links.slice(0, 10).forEach(link => {
        prompt += `  - "${link.text}": ${link.href}\n`;
      });
    }

    prompt += `
以下の形式でテストケースを提案してください：

1. テストケース名: [名前]
   カテゴリ: [カテゴリ]
   優先度: [High/Medium/Low]
   テスト内容: [何をテストするか]
   手順:
   - [ステップ1]
   - [ステップ2]
   期待結果: [期待される結果]

複数のテストケースを提案してください。特に以下を重視：
- フォームの入力と送信
- ボタンのクリック動作
- ナビゲーションの確認
- エラーハンドリング
- 必須フィールドの検証`;

    return prompt;
  }

  parseAIResponse(response, pageInfo) {
    // AI応答からテストケースを抽出
    const testCases = [];
    
    console.log(chalk.yellow('\n🔍 AI応答を解析中...'));
    console.log(chalk.gray(`応答長: ${response.length}文字`));
    
    try {
      // シンプルなパターンマッチングでテストケース抽出
      const casePatterns = response.split(/\d+\.\s*テストケース名:/);
      console.log(chalk.gray(`検出されたパターン数: ${casePatterns.length - 1}`));
      
      casePatterns.forEach((caseText, index) => {
        if (index === 0 || !caseText.trim()) return;
        
        const testCase = {
          name: this.extractValue(caseText, /^([^\n]+)/, 'テストケース' + index),
          category: this.extractValue(caseText, /カテゴリ:\s*([^\n]+)/, '一般'),
          priority: this.extractValue(caseText, /優先度:\s*(High|Medium|Low)/i, 'Medium'),
          description: this.extractValue(caseText, /テスト内容:\s*([^\n]+)/, ''),
          steps: this.extractSteps(caseText, pageInfo),
          expectedResult: this.extractValue(caseText, /期待結果:\s*([^\n]+)/, ''),
          pageInfo: pageInfo
        };
        
        if (testCase.name) {
          testCases.push(testCase);
        }
      });
      
    } catch (error) {
      console.error(chalk.yellow('AI応答のパース中にエラー:'), error.message);
    }
    
    // テストケースが取得できなかった場合はフォールバック
    if (testCases.length === 0) {
      console.log(chalk.yellow('⚠️  パターンマッチングで取得できず、フォールバック生成'));
      return this.generateFallbackTestCases(pageInfo);
    }
    
    console.log(chalk.green(`✅ 解析完了: ${testCases.length}件のテストケース`));
    return testCases;
  }

  extractValue(text, pattern, defaultValue = '') {
    const match = text.match(pattern);
    return match ? match[1].trim() : defaultValue;
  }

  extractSteps(text, pageInfo) {
    const steps = [];
    const stepsMatch = text.match(/手順:([\s\S]*?)(?=期待結果:|$)/);
    
    if (stepsMatch) {
      const stepsText = stepsMatch[1];
      const stepLines = stepsText.split('\n');
      const actualUrl = pageInfo?.url || this.config.test_targets?.[0]?.base_url || 'http://localhost:3000';
      const credentials = this.config.test_targets?.[0]?.login_credentials;
      const userEmail = credentials?.user?.email || 'test@example.com';
      const userPassword = credentials?.user?.password || 'password123';
      
      stepLines.forEach(line => {
        let cleaned = line.replace(/^[\s-]+/, '').trim();
        if (cleaned && !cleaned.startsWith('期待結果')) {
          // URLの置換
          // URLの置換（バッククォート内も含む）
          cleaned = cleaned
            .replace(/https?:\/\/example\.com[\/]*/gi, actualUrl)
            .replace(/`https?:\/\/example\.com[\/]*`/gi, `\`${actualUrl}\``)
            .replace(/`https?:\/\/localhost:\d+[\/]*`/gi, `\`${actualUrl}\``)
            .replace(/https?:\/\/localhost:\d+[\/]*/g, actualUrl)
            // 認証情報の置換
            .replace(/testuser/gi, userEmail)
            .replace(/test@example\.com/gi, userEmail) 
            .replace(/password123/gi, userPassword);
          steps.push(cleaned);
        }
      });
    }
    
    return steps;
  }

  generateFallbackTestCases(pageInfo) {
    const testCases = [];
    
    // 基本的なページ表示テスト
    testCases.push({
      name: 'ページ表示確認',
      category: '基本機能',
      priority: 'High',
      description: 'ページが正常に表示されることを確認',
      steps: [
        `${pageInfo.url}にアクセス`,
        'ページの読み込み完了を待機',
        'タイトルを確認'
      ],
      expectedResult: `ページタイトル「${pageInfo.title}」が表示される`,
      pageInfo: pageInfo
    });

    // フォームテスト
    if (pageInfo.elements.forms?.length > 0) {
      pageInfo.elements.forms.forEach((form, index) => {
        // 正常系
        testCases.push({
          name: `フォーム${index + 1}送信テスト（正常系）`,
          category: 'フォーム機能',
          priority: 'High',
          description: 'フォームに正しい値を入力して送信',
          steps: this.generateFormSteps(form, 'valid'),
          expectedResult: 'フォームが正常に送信される',
          pageInfo: pageInfo
        });

        // 異常系（必須フィールド）
        const requiredFields = form.inputs.filter(i => i.required);
        if (requiredFields.length > 0) {
          testCases.push({
            name: `フォーム${index + 1}必須フィールド検証`,
            category: 'フォーム機能',
            priority: 'Medium',
            description: '必須フィールドを空にして送信',
            steps: this.generateFormSteps(form, 'required'),
            expectedResult: '必須フィールドのエラーメッセージが表示される',
            pageInfo: pageInfo
          });
        }
        
        // 異常系（無効な認証情報）
        const hasLoginFields = form.inputs.some(i => 
          i.type === 'password' || 
          (i.type === 'email' || (i.type === 'text' && (i.name?.includes('user') || i.name?.includes('email'))))
        );
        
        if (hasLoginFields) {
          testCases.push({
            name: `フォーム${index + 1}無効な認証情報`,
            category: 'フォーム機能/エラーハンドリング',
            priority: 'Medium',
            description: '無効な認証情報で送信',
            steps: this.generateFormSteps(form, 'invalid'),
            expectedResult: '認証エラーメッセージが表示される',
            pageInfo: pageInfo
          });
        }
      });
    }

    // ボタンクリックテスト
    if (pageInfo.elements.buttons?.length > 0) {
      pageInfo.elements.buttons.slice(0, 5).forEach(button => {
        if (button.text) {
          testCases.push({
            name: `「${button.text}」ボタンクリックテスト`,
            category: 'UI操作',
            priority: 'Medium',
            description: `${button.text}ボタンの動作確認`,
            steps: [
              'ページにアクセス',
              `「${button.text}」ボタンをクリック`
            ],
            expectedResult: 'ボタンが正常に動作する',
            pageInfo: pageInfo
          });
        }
      });
    }

    // ナビゲーションテスト
    if (pageInfo.elements.links?.length > 0) {
      const mainLinks = pageInfo.elements.links.slice(0, 3);
      mainLinks.forEach(link => {
        if (link.text && !link.href.includes('javascript:')) {
          testCases.push({
            name: `「${link.text}」リンク遷移テスト`,
            category: 'ナビゲーション',
            priority: 'Low',
            description: `${link.text}リンクの遷移確認`,
            steps: [
              'ページにアクセス',
              `「${link.text}」リンクをクリック`,
              '遷移先ページの確認'
            ],
            expectedResult: '正しいページに遷移する',
            pageInfo: pageInfo
          });
        }
      });
    }

    return testCases;
  }

  generateFormSteps(form, type) {
    const steps = ['ページにアクセス'];
    
    // settings.jsonから認証情報を取得
    const credentials = this.config.test_targets?.[0]?.login_credentials;
    const userEmail = credentials?.user?.email || 'test@example.com';
    const userPassword = credentials?.user?.password || 'password123';
    
    if (type === 'valid') {
      // 正常系の入力 - settings.jsonの値を使用
      form.inputs.forEach(input => {
        const inputName = input.name || input.id || input.placeholder || 'フィールド';
        
        if (input.type === 'email' || (input.type === 'text' && inputName.toLowerCase().includes('email'))) {
          steps.push(`${inputName}に「${userEmail}」を入力`);
        } else if (input.type === 'text' && (inputName.toLowerCase().includes('user') || inputName.toLowerCase().includes('name'))) {
          steps.push(`${inputName}に「${userEmail}」を入力`);
        } else if (input.type === 'password') {
          steps.push(`${inputName}に「${userPassword}」を入力`);
        } else if (input.type === 'textarea') {
          steps.push(`${inputName}に「テストテキスト」を入力`);
        } else if (input.type === 'text') {
          steps.push(`${inputName}に「テスト入力」を入力`);
        }
      });
    } else if (type === 'required') {
      // 必須フィールド検証 - 一部フィールドを空に
      form.inputs.forEach(input => {
        const inputName = input.name || input.id || input.placeholder || 'フィールド';
        
        if (!input.required && (input.type === 'text' || input.type === 'email')) {
          steps.push(`${inputName}に「test」を入力`);
        }
      });
      steps.push('必須フィールドを空のまま');
    } else if (type === 'invalid') {
      // 異常系の入力 - ダミー値を使用
      form.inputs.forEach(input => {
        const inputName = input.name || input.id || input.placeholder || 'フィールド';
        
        if (input.type === 'email' || (input.type === 'text' && inputName.toLowerCase().includes('email'))) {
          steps.push(`${inputName}に「invalid@dummy.com」を入力`);
        } else if (input.type === 'text' && (inputName.toLowerCase().includes('user') || inputName.toLowerCase().includes('name'))) {
          steps.push(`${inputName}に「invaliduser」を入力`);
        } else if (input.type === 'password') {
          steps.push(`${inputName}に「wrongpassword」を入力`);
        }
      });
    }
    
    steps.push('送信ボタンをクリック');
    return steps;
  }

  async convertToPlaywrightTests(testCases) {
    const playwrightTests = [];
    
    for (const testCase of testCases) {
      const test = await this.generatePlaywrightCode(testCase);
      playwrightTests.push(test);
    }
    
    return playwrightTests;
  }

  async generatePlaywrightCode(testCase) {
    const steps = [];
    
    // URLアクセス
    const targetUrl = testCase.target_url || testCase.pageInfo?.url || 'http://localhost:3000';
    steps.push(`  await page.goto('${targetUrl}');`);
    
    // 各ステップをPlaywrightコードに変換
    const testSteps = testCase.test_steps || testCase.steps || [];
    testSteps.forEach(step => {
      // 新形式のステップ（オブジェクト）の場合
      if (typeof step === 'object' && step.action) {
        const code = this.stepObjectToPlaywrightCode(step);
        if (code) {
          steps.push(code);
        }
      } else {
        // 旧形式のステップ（文字列）の場合
        const code = this.stepToPlaywrightCode(step, testCase.pageInfo);
        if (code) {
          steps.push(code);
        }
      }
    });
    
    // アサーション追加
    const expectedResult = testCase.expected_result || testCase.expectedResult;
    if (expectedResult) {
      steps.push(`  // ${expectedResult}`);
    }
    
    const testName = testCase.test_case_name || testCase.name || 'テストケース';
    const code = `test('${testName}', async ({ page }) => {
${steps.join('\n')}
});`;
    
    return {
      name: testName,
      category: testCase.test_category || testCase.category || '一般',
      priority: testCase.priority || 'medium',
      code: code,
      steps: testSteps,
      expectedResult: expectedResult
    };
  }

  // 新形式のステップオブジェクトをPlaywrightコードに変換
  stepObjectToPlaywrightCode(step) {
    switch(step.action) {
      case 'goto':
        return `  await page.goto('${step.target}');`;
      case 'click':
        return `  await page.click('${step.target}'); // ${step.description || ''}`;
      case 'fill':
        return `  await page.fill('${step.target}', '${step.value}'); // ${step.description || ''}`;
      case 'select':
        return `  await page.selectOption('${step.target}', '${step.value}'); // ${step.description || ''}`;
      case 'check':
        return `  await page.check('${step.target}'); // ${step.description || ''}`;
      case 'uncheck':
        return `  await page.uncheck('${step.target}'); // ${step.description || ''}`;
      case 'wait':
        return `  await page.waitForTimeout(${step.target}); // ${step.description || ''}`;
      case 'wait_for_selector':
        return `  await page.waitForSelector('${step.target}'); // ${step.description || ''}`;
      case 'wait_for_navigation':
        return `  await page.waitForURL('${step.target}'); // ${step.description || ''}`;
      case 'screenshot':
        return `  await page.screenshot({ path: '${step.target}.png' }); // ${step.description || ''}`;
      default:
        return `  // ${step.description || step.action}`;
    }
  }

  stepToPlaywrightCode(step, pageInfo) {
    const stepLower = step.toLowerCase();
    
    // クリック操作
    if (stepLower.includes('クリック')) {
      const match = step.match(/「(.+?)」/);
      if (match) {
        const target = match[1];
        // ボタンを探す
        const button = pageInfo?.elements?.buttons?.find(b => 
          b.text?.includes(target)
        );
        if (button?.selector) {
          return `  await page.click('${button.selector}');`;
        }
        // リンクを探す
        const link = pageInfo?.elements?.links?.find(l => 
          l.text?.includes(target)
        );
        if (link?.selector) {
          return `  await page.click('${link.selector}');`;
        }
        return `  await page.click('text=${target}');`;
      }
    }
    
    // 入力操作
    if (stepLower.includes('入力')) {
      const fieldMatch = step.match(/(.+?)に「(.+?)」を入力/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        const value = fieldMatch[2];
        // 入力フィールドを探す
        const input = pageInfo?.elements?.inputs?.find(i => 
          i.name?.includes(fieldName) || 
          i.id?.includes(fieldName) ||
          i.placeholder?.includes(fieldName)
        );
        if (input?.selector) {
          return `  await page.fill('${input.selector}', '${value}');`;
        }
        return `  await page.fill('[name="${fieldName}"]', '${value}');`;
      }
    }
    
    // 待機
    if (stepLower.includes('待機') || stepLower.includes('完了')) {
      return `  await page.waitForLoadState('networkidle');`;
    }
    
    // その他はコメントとして追加
    return `  // ${step}`;
  }

  async saveGeneratedTestCases(testCases) {
    const savedCases = [];
    
    console.log(chalk.blue(`\n📝 保存するテストケース数: ${testCases.length}`));
    
    for (const testCase of testCases) {
      const testId = this.generateTestId();
      // URLのクリーンアップ（末尾スラッシュを削除し、重複を防ぐ）
      // target_urlが明示的に設定されているはずなので、それを最優先で使用
      let actualUrl = testCase.target_url;
      
      // フォールバック（通常は発生しないはず）
      if (!actualUrl) {
        actualUrl = testCase.pageInfo?.url;
        if (!actualUrl) {
          console.log(chalk.yellow(`  ⚠️ テストケースにURLが設定されていません。settings.jsonを使用します。`));
          actualUrl = this.config.test_targets?.[0]?.base_url || 'http://localhost:3000';
        }
      }
      // URLクリーンアップを慎重に実施
      if (actualUrl && actualUrl.length > 0) {
        // 末尾のスラッシュのみ削除（プロトコル部分は保持）
        actualUrl = actualUrl.replace(/\/+$/, '');
        // 重複スラッシュを修正（プロトコル部分は除外）
        actualUrl = actualUrl.replace(/([^:])\/\/+/g, '$1/');
      }
      console.log(chalk.gray(`  使用URL: ${actualUrl}`));
      
      const credentials = this.config.test_targets?.[0]?.login_credentials;
      const userEmail = credentials?.user?.email || 'test@example.com';
      const userPassword = credentials?.user?.password || 'password123';
      
      const newTestCase = {
        test_id: testId,
        test_category: testCase.test_category || testCase.category,
        test_case_name: testCase.test_case_name || testCase.name,
        priority: testCase.priority,
        target_url: actualUrl,  // 専用のURLフィールドを追加
        link_text: testCase.link_text,
        button_text: testCase.button_text,
        destination_url: testCase.destination_url,
        value: testCase.value, // XSS/SQLペイロード用
        preconditions: `${actualUrl}にアクセス可能`,
        test_steps: (testCase.test_steps || testCase.steps || []).map((step, stepIndex) => {
          // 新しい形式のステップ（オブジェクト）の場合
          if (typeof step === 'object' && step !== null) {
            const normalized = { 
              step_number: step.step_number || stepIndex + 1,
              action: step.action || 'manual',
              target: step.target,
              value: step.value,
              description: step.description,
              link_text: step.link_text,
              button_text: step.button_text
            };
            // normalize action aliases
            if (normalized.action === 'waitForNavigation') normalized.action = 'wait_for_navigation';
            if (normalized.action === 'waitForSelector') normalized.action = 'wait_for_selector';
            if (normalized.action === 'wait' && normalized.value == null && normalized.target != null) {
              normalized.value = String(normalized.target); normalized.target = undefined;
            }
            if (normalized.action === 'wait') normalized.value = String(normalized.value ?? '1000');
            if (normalized.action === 'fill') normalized.value = String(normalized.value ?? '');
            if ((normalized.action === 'select' || normalized.action === 'selectOption') && normalized.value != null) {
              normalized.value = String(normalized.value);
            }
            return normalized;
          }
          
          // 旧形式のステップ（文字列）の場合
          const stepStr = String(step);
          
          // URLアクセスステップは実際のURLを含む形式で保持
          if (stepStr.toLowerCase().includes('アクセス')) {
            // URLを含むステップの場合、実際のURLに置換
            let accessStep = stepStr
              .replace(/https?:\/\/example\.com[\/]*/gi, actualUrl)
              .replace(/https?:\/\/localhost:\d+[\/]*/g, actualUrl)
              .replace(/`https?:\/\/[^`]+`/gi, `\`${actualUrl}\``);
            
            // 「指定のURL」「ページ」等の曖昧な表現を実際のURLに置換
            if (accessStep.includes('指定のURL') || accessStep.includes('ページにアクセス')) {
              accessStep = `${actualUrl}にアクセス`;
            }
            
            return {
              step_number: stepIndex + 1,
              action: 'manual',
              description: accessStep
            };
          }
          
          // その他のステップ処理
          let processedStep = stepStr
            .replace(/https?:\/\/example\.com[\/]*/gi, actualUrl)
            .replace(/https?:\/\/localhost:\d+[\/]*/g, actualUrl);
          
          // バッククォート内のURLは実際のURLに置換（「指定のURL」にはしない）
          processedStep = processedStep.replace(/`https?:\/\/[^`]+`/gi, `\`${actualUrl}\``);
          
          // 正常系のテストケースでは実際の認証情報を使用
          const isValidCase = (testCase.category && testCase.category.includes('正常')) || 
                             (testCase.name && testCase.name.includes('正常')) || 
                             (testCase.testName && testCase.testName.includes('正常')) ||
                             (!testCase.category?.includes('エラー') && !testCase.category?.includes('必須') && 
                              !testCase.name?.includes('無効') && !testCase.testName?.includes('無効'));
          
          if (isValidCase) {
            // 日本語表現も含めて置換
            processedStep = processedStep
              .replace(/有効なユーザー名（例:\s*"[^"]*"）/gi, `「${userEmail}」`)
              .replace(/有効なユーザー名/gi, `「${userEmail}」`)
              .replace(/有効なパスワード（例:\s*"[^"]*"）/gi, `「${userPassword}」`)
              .replace(/有効なパスワード/gi, `「${userPassword}」`)
              .replace(/testuser/gi, userEmail)
              .replace(/test@example\.com/gi, userEmail)
              .replace(/password123/gi, userPassword);
          } else {
            // エラー系の場合はダミー値を明示
            processedStep = processedStep
              .replace(/無効なユーザー名（例:\s*[^）]*）/gi, `「invalid_user」`)
              .replace(/無効なパスワード（例:\s*[^）]*）/gi, `「wrong_password」`)
              .replace(/invalid_user/gi, 'invalid_user')
              .replace(/invalid_password/gi, 'wrong_password');
          }
          
          return {
            step_number: stepIndex + 1,
            action: 'manual',
            description: processedStep
          };
        }),
        expected_result: testCase.expected_result || testCase.expectedResult,
        test_data: {
          generated_by: 'AI自動生成',
          source_url: actualUrl,
          generation_date: this.getJSTTimestamp()
        },
        generated_playwright_code: testCase.code || '',
        screenshots: testCase.pageInfo?.screenshot ? [testCase.pageInfo.screenshot] : [],
        created_date: this.getJSTTimestamp(),
        updated_date: this.getJSTTimestamp()
      };

      // セキュリティテストでステップが空の場合は最低限の手順を合成
      const isSecurity = (newTestCase.test_category === 'セキュリティ') || (testCase.test_type === 'security');
      if (isSecurity && (!newTestCase.test_steps || newTestCase.test_steps.length === 0)) {
        const selector = testCase.selector || testCase.field_selector || '';
        const payload = String(testCase.test_data?.payload ?? testCase.value ?? '');
        if (selector && payload) {
          newTestCase.test_steps = [
            { step_number: 1, action: 'goto', target: actualUrl, description: 'ページにアクセス' },
            { step_number: 2, action: 'wait_for_selector', target: selector, description: '入力フィールドの表示を待機' },
            { step_number: 3, action: 'clear', target: selector, description: '入力フィールドをクリア' },
            { step_number: 4, action: 'fill', target: selector, value: payload, description: '攻撃ペイロードを入力' },
            { step_number: 5, action: 'press', target: selector, value: 'Enter', description: 'Enterキーで送信を試行' },
            { step_number: 6, action: 'wait', value: '1500', description: '結果を待機' },
            { step_number: 7, action: 'check_alert', description: 'アラート未発火を確認' }
          ];
        } else {
          console.log(chalk.gray(`  🗑️  不完全なセキュリティテストを除外: ${newTestCase.test_case_name}`));
          continue;
        }
      }

      // セキュリティの前提条件にペイロード表記を追加
      if (isSecurity) {
        const payloadInfo = String(testCase.test_data?.payload ?? testCase.value ?? '');
        if (payloadInfo) newTestCase.preconditions += ` | ペイロード: ${payloadInfo}`;
      }
      
      this.testCases.test_cases.push(newTestCase);
      savedCases.push(newTestCase);
    }
    
    // 保存（新規作成として保存、既存ファイルはリネーム）
    console.log(chalk.green(`✅ テストケース配列に追加完了: ${this.testCases.test_cases.length}件`));
    
    const manager = new TestCaseManager();
    manager.testCases = this.testCases;
    manager.saveTestCases({ createNew: true, resetContent: false });
    
    return savedCases;
  }

  generateTestId() {
    const existingIds = this.testCases.test_cases.map(tc => tc.test_id);
    let id = 1;
    let testId;
    
    do {
      testId = `TC${String(id).padStart(3, '0')}`;
      id++;
    } while (existingIds.includes(testId));
    
    return testId;
  }

  async setupBrowserSession(url) {
    console.log(chalk.cyan('\n🌐 ブラウザセッションを準備中...\n'));
    
    // ブラウザ起動
    const defaultArgs = ['--lang=ja-JP', '--font-render-hinting=none'];
    const configArgs = playwrightConfig?.use?.launchOptions?.args || [];
    
    const browser = await chromium.launch({
      headless: false, // セッション維持時は必ず表示モード
      args: [...new Set([...defaultArgs, ...configArgs])],
      ...(playwrightConfig?.use?.launchOptions || {})
    });
    
    // 保存されたログイン状態があるか確認
    const storageStatePath = path.join(process.cwd(), 'config', 'auth-state.json');
    let storageState = null;
    
    if (fs.existsSync(storageStatePath)) {
      const { useExisting } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useExisting',
          message: '以前のログイン状態を使用しますか？',
          default: true
        }
      ]);
      
      if (useExisting) {
        storageState = storageStatePath;
        console.log(chalk.green('✅ 保存されたログイン状態を読み込みました'));
      }
    }
    
    // コンテキスト設定を統合
    const context = await browser.newContext({
      locale: playwrightConfig?.use?.locale || 'ja-JP',
      timezoneId: playwrightConfig?.use?.timezoneId || 'Asia/Tokyo',
      ...(playwrightConfig?.use?.contextOptions || {}),
      ...(storageState ? { storageState } : {})
    });
    
    const page = await context.newPage();
    
    // タイムアウトを延長
    page.setDefaultTimeout(60000); // 60秒に設定
    page.setDefaultNavigationTimeout(60000); // ナビゲーションも60秒に設定
    
    // 初期URLにアクセス（タイムアウトとwaitUntilを調整）
    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', // networkidleより早く完了する条件
        timeout: 60000 
      });
      
      // 追加で少し待機（重いサイトの場合）
      await page.waitForTimeout(3000);
    } catch (error) {
      if (error.name === 'TimeoutError') {
        console.log(chalk.yellow('\n⚠️  ページの読み込みに時間がかかっています。続行します...'));
        // タイムアウトしても現在の状態で続行
      } else {
        throw error;
      }
    }
    
    console.log(chalk.yellow(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 ブラウザが起動しました
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 必要に応じてログインしてください
2. テストしたいページに移動してください
3. 準備ができたらEnterキーを押してください

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `));
    
    // ユーザーの準備完了を待つ
    await inquirer.prompt([
      {
        type: 'input',
        name: 'ready',
        message: '準備ができたらEnterキーを押してください'
      }
    ]);
    
    // ログイン状態を保存（Cookie、LocalStorage等）
    await context.storageState({ path: storageStatePath });
    console.log(chalk.green('✅ ログイン状態を保存しました'));
    
    return { browser, page, context };
  }

  async captureScreenshot(page, prefix) {
    const screenshotsDir = path.join(process.cwd(), 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    const filename = `${prefix}_${Date.now()}.png`;
    const filepath = path.join(screenshotsDir, filename);
    
    await page.screenshot({
      path: filepath,
      fullPage: true
    });
    
    return `screenshots/${filename}`;
  }

  async interactiveAutoGenerate() {
    console.log(chalk.cyan('━'.repeat(60)));
    console.log(chalk.bold.cyan('🤖 AI自動テストケース生成'));
    console.log(chalk.cyan('━'.repeat(60)));
    
    // URL選択または入力
    const urlChoices = [];
    const target = this.config.test_targets?.[0];
    
    if (target?.base_url) {
      urlChoices.push({
        name: `Base URL: ${target.base_url}`,
        value: target.base_url
      });
    }
    
    if (target?.admin_url) {
      urlChoices.push({
        name: `Admin URL: ${target.admin_url}`,
        value: target.admin_url
      });
    }
    
    urlChoices.push({
      name: 'カスタムURLを入力',
      value: 'custom'
    });
    
    const { urlChoice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'urlChoice',
        message: 'テスト対象のURLを選択:',
        choices: urlChoices,
        default: target?.base_url
      }
    ]);
    
    let url = urlChoice;
    
    // カスタムURLの場合は入力を求める
    if (urlChoice === 'custom') {
      const { customUrl } = await inquirer.prompt([
        {
          type: 'input',
          name: 'customUrl',
          message: 'テスト対象のURLを入力:',
          validate: (input) => {
            try {
              new URL(input);
              return true;
            } catch {
              return '有効なURLを入力してください';
            }
          }
        }
      ]);
      url = customUrl;
    }
    
    // ログイン状態を維持するか確認
    const { keepSession } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'keepSession',
        message: '現在のブラウザセッションを維持しますか？（ログイン状態などを保持）',
        default: false
      }
    ]);
    
    // セッション維持の場合はブラウザを起動してログイン
    let existingPage = null;
    let sessionContext = null;
    if (keepSession) {
      console.log(chalk.cyan(`\n選択されたURL: ${url}`));
      const { browser, page, context } = await this.setupBrowserSession(url);
      existingPage = page;
      sessionContext = context;
      this.sessionBrowser = browser; // 後で閉じるために保持
      this.sessionContext = context; // コンテキストも保持
    } else {
      console.log(chalk.cyan(`\n選択されたURL: ${url}`));
    }
    
    // ページ解析
    const analysis = await this.analyzePageWithAI(url, { existingPage });
    
    // 結果表示
    console.log(chalk.green('\n✅ ページ解析完了\n'));
    console.log(chalk.blue('検出された要素:'));
    console.log(`  フォーム: ${analysis.pageInfo.elements.forms?.length || 0}個`);
    console.log(`  ボタン: ${analysis.pageInfo.elements.buttons?.length || 0}個`);
    console.log(`  リンク: ${analysis.pageInfo.elements.links?.length || 0}個`);
    console.log(`  入力フィールド: ${analysis.pageInfo.elements.inputs?.length || 0}個`);
    
    console.log(chalk.green(`\n🎯 ${analysis.testSuggestions.length}個のテストケースを生成しました\n`));
    
    // テストケース一覧表示
    analysis.testSuggestions.forEach((test, index) => {
      const testName = test.test_case_name || test.name || `テストケース${index + 1}`;
      const category = test.test_category || test.category || '一般';
      const priority = test.priority || 'medium';
      const description = test.description || test.expected_result || 
                         (test.test_steps && test.test_steps[0]?.description) ||
                         (test.steps && test.steps[0]) || 'テストケース';
      
      console.log(chalk.yellow(`${index + 1}. ${testName}`));
      console.log(`   カテゴリ: ${category} | 優先度: ${priority}`);
      console.log(`   説明: ${description}`);
    });
    
    // 保存確認
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'どの操作を実行しますか？',
        choices: [
          { name: '全てのテストケースを保存', value: 'save_all' },
          { name: 'テストケースを選択して保存', value: 'save_selected' },
          { name: 'Playwrightコードを表示', value: 'show_code' },
          { name: 'キャンセル', value: 'cancel' }
        ]
      }
    ]);
    
    switch (action) {
      case 'save_all':
        const saved = await this.saveGeneratedTestCases(analysis.testSuggestions);
        console.log(chalk.green(`\n✅ ${saved.length}個のテストケースを保存しました`));
        saved.forEach(tc => {
          console.log(`  ${tc.test_id}: ${tc.test_case_name}`);
        });
        break;
        
      case 'save_selected':
        const { selected } = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'selected',
            message: '保存するテストケースを選択:',
            choices: analysis.testSuggestions.map((test, index) => ({
              name: `${test.test_case_name || test.name || `テストケース${index + 1}`} (${test.test_category || test.category || '一般'})`,
              value: index
            }))
          }
        ]);
        
        if (selected.length > 0) {
          const selectedTests = selected.map(i => analysis.testSuggestions[i]);
          const savedSelected = await this.saveGeneratedTestCases(selectedTests);
          console.log(chalk.green(`\n✅ ${savedSelected.length}個のテストケースを保存しました`));
        }
        break;
        
      case 'show_code':
        const playwrightTests = await this.convertToPlaywrightTests(analysis.testSuggestions);
        console.log(chalk.cyan('\n📝 Playwrightコード:\n'));
        playwrightTests.forEach(test => {
          console.log(chalk.yellow(`// ${test.name}`));
          console.log(test.code);
          console.log('');
        });
        break;
        
      case 'cancel':
        console.log(chalk.yellow('キャンセルしました'));
        break;
    }
    
    // セッションブラウザがある場合は閉じる
    if (this.sessionBrowser) {
      console.log(chalk.gray('\nブラウザセッションを終了中...'));
      await this.sessionBrowser.close();
      this.sessionBrowser = null;
    }
  }
}

export default TestCaseAutoGenerator;
