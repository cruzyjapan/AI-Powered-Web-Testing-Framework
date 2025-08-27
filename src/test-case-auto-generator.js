import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import ConfigManager from './config-manager.js';
import CLIManager from './cli-manager.js';

class TestCaseAutoGenerator {
  constructor(options = {}) {
    this.options = options;
    this.configManager = new ConfigManager();
    this.config = this.configManager.config;
    this.cliManager = new CLIManager(this.config);
    this.testCasesPath = path.join(process.cwd(), 'config', 'test-cases.json');
    this.testCases = this.loadTestCases();
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
      last_updated: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  async analyzePageWithAI(url) {
    console.log(chalk.cyan('\n🤖 AI駆動ページ解析開始\n'));
    
    const spinner = ora('ページを解析中...').start();
    
    try {
      // ブラウザ起動
      const browser = await chromium.launch({
        headless: this.options.headless !== false
      });
      
      const context = await browser.newContext();
      const page = await context.newPage();
      
      // ページにアクセス
      spinner.text = `${url} にアクセス中...`;
      await page.goto(url, { waitUntil: 'networkidle' });
      
      // ページ情報を収集
      spinner.text = 'ページ要素を分析中...';
      const pageInfo = await this.collectPageInfo(page);
      
      // スクリーンショット撮影
      const screenshotPath = await this.captureScreenshot(page, 'page-analysis');
      pageInfo.screenshot = screenshotPath;
      
      spinner.succeed('ページ解析完了');
      
      // AI CLIでテストケース提案を生成
      console.log(chalk.cyan('\n🧠 AI CLIでテストケースを生成中...\n'));
      const testSuggestions = await this.generateTestSuggestionsWithAI(pageInfo);
      
      await browser.close();
      
      return {
        pageInfo,
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
    let prompt = `以下のWebページ情報から、自動テストケースを生成してください。

URL: ${pageInfo.url}
タイトル: ${pageInfo.title}

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
    
    try {
      // シンプルなパターンマッチングでテストケース抽出
      const casePatterns = response.split(/\d+\.\s*テストケース名:/);
      
      casePatterns.forEach((caseText, index) => {
        if (index === 0 || !caseText.trim()) return;
        
        const testCase = {
          name: this.extractValue(caseText, /^([^\n]+)/, 'テストケース' + index),
          category: this.extractValue(caseText, /カテゴリ:\s*([^\n]+)/, '一般'),
          priority: this.extractValue(caseText, /優先度:\s*(High|Medium|Low)/i, 'Medium'),
          description: this.extractValue(caseText, /テスト内容:\s*([^\n]+)/, ''),
          steps: this.extractSteps(caseText),
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
      return this.generateFallbackTestCases(pageInfo);
    }
    
    return testCases;
  }

  extractValue(text, pattern, defaultValue = '') {
    const match = text.match(pattern);
    return match ? match[1].trim() : defaultValue;
  }

  extractSteps(text) {
    const steps = [];
    const stepsMatch = text.match(/手順:([\s\S]*?)(?=期待結果:|$)/);
    
    if (stepsMatch) {
      const stepsText = stepsMatch[1];
      const stepLines = stepsText.split('\n');
      
      stepLines.forEach(line => {
        const cleaned = line.replace(/^[\s-]+/, '').trim();
        if (cleaned && !cleaned.startsWith('期待結果')) {
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
    
    if (type === 'valid') {
      // 正常系の入力
      form.inputs.forEach(input => {
        if (input.type === 'text' || input.type === 'email') {
          steps.push(`${input.name || input.id}に「test@example.com」を入力`);
        } else if (input.type === 'password') {
          steps.push(`${input.name || input.id}に「password123」を入力`);
        } else if (input.type === 'textarea') {
          steps.push(`${input.name || input.id}に「テストテキスト」を入力`);
        }
      });
    } else if (type === 'required') {
      // 必須フィールドを空に
      form.inputs.forEach(input => {
        if (!input.required && (input.type === 'text' || input.type === 'email')) {
          steps.push(`${input.name || input.id}に「test」を入力`);
        }
      });
      steps.push('必須フィールドを空のまま');
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
    if (testCase.pageInfo?.url) {
      steps.push(`  await page.goto('${testCase.pageInfo.url}');`);
    }
    
    // 各ステップをPlaywrightコードに変換
    testCase.steps.forEach(step => {
      const code = this.stepToPlaywrightCode(step, testCase.pageInfo);
      if (code) {
        steps.push(code);
      }
    });
    
    // アサーション追加
    if (testCase.expectedResult) {
      steps.push(`  // ${testCase.expectedResult}`);
    }
    
    const code = `test('${testCase.name}', async ({ page }) => {
${steps.join('\n')}
});`;
    
    return {
      name: testCase.name,
      category: testCase.category,
      priority: testCase.priority,
      code: code,
      steps: testCase.steps,
      expectedResult: testCase.expectedResult
    };
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
    
    for (const testCase of testCases) {
      const testId = this.generateTestId();
      
      const newTestCase = {
        test_id: testId,
        test_category: testCase.category,
        test_case_name: testCase.name,
        priority: testCase.priority,
        preconditions: testCase.pageInfo?.url ? `${testCase.pageInfo.url}にアクセス可能` : '',
        test_steps: testCase.steps.map((step, index) => ({
          step_number: index + 1,
          action: 'manual',
          description: step
        })),
        expected_result: testCase.expectedResult,
        test_data: {
          generated_by: 'AI自動生成',
          source_url: testCase.pageInfo?.url,
          generation_date: new Date().toISOString()
        },
        generated_playwright_code: testCase.code || '',
        screenshots: testCase.pageInfo?.screenshot ? [testCase.pageInfo.screenshot] : [],
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString()
      };
      
      this.testCases.test_cases.push(newTestCase);
      savedCases.push(newTestCase);
    }
    
    // 保存
    this.testCases.last_updated = new Date().toISOString();
    fs.writeFileSync(this.testCasesPath, JSON.stringify(this.testCases, null, 2), 'utf8');
    
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
    
    // URL入力
    const { url } = await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: 'テスト対象のURLを入力:',
        default: this.config.test_targets?.[0]?.base_url || 'http://localhost:4009/',
        validate: (input) => {
          try {
            new URL(input);
            return true;
          } catch {
            return 'valid な URLを入力してください';
          }
        }
      }
    ]);
    
    // ページ解析
    const analysis = await this.analyzePageWithAI(url);
    
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
      console.log(chalk.yellow(`${index + 1}. ${test.name}`));
      console.log(`   カテゴリ: ${test.category} | 優先度: ${test.priority}`);
      console.log(`   説明: ${test.description || test.steps[0]}`);
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
              name: `${test.name} (${test.category})`,
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
  }
}

export default TestCaseAutoGenerator;