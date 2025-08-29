import { chromium, firefox, webkit } from 'playwright';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import ConfigManager from './config-manager.js';

class TestCaseRecorder {
  constructor(options = {}) {
    this.options = options;
    this.configManager = new ConfigManager();
    this.config = this.configManager.config;
    this.testCasesPath = path.join(process.cwd(), 'config', 'test-cases.json');
    this.testCases = this.loadTestCases();
    this.recordedSteps = [];
    this.screenshots = [];
    this.browserType = options.browser || 'chromium';
  }

  /**
   * ブラウザタイプに応じたPlaywrightブラウザを取得
   */
  getBrowser(type) {
    const browsers = {
      'chromium': chromium,
      'firefox': firefox,
      'webkit': webkit,
      'chrome': chromium,
      'safari': webkit
    };
    return browsers[type.toLowerCase()] || chromium;
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

  async startRecording(url) {
    console.log(chalk.cyan('\n🎬 録画モードでテストケース作成開始\n'));
    console.log(chalk.yellow('ヒント: ブラウザで操作を行うと、自動的にテストステップが記録されます'));
    console.log(chalk.yellow('録画を終了するには、ブラウザを閉じるか、Ctrl+C を押してください\n'));

    const spinner = ora('ブラウザを起動中...').start();
    
    // 録画データの初期化
    this.recording = {
      name: '',
      url: url,
      startTime: new Date().toISOString(),
      endTime: '',
      actions: [],
      screenshots: []
    };
    
    try {
      // URLのクリーンアップ
      const cleanUrl = url.replace(/\/+$/, '').replace(/\/+/g, '/').replace(':/', '://');
      this.recording.url = cleanUrl;
      
      // ブラウザタイプに応じて起動
      const browserToUse = this.getBrowser(this.browserType);
      const browserName = this.browserType.toLowerCase();
      
      console.log(chalk.cyan(`🌐 使用ブラウザ: ${browserName.toUpperCase()}`));
      
      const browser = await browserToUse.launch({
        headless: false,
        args: browserName === 'chromium' || browserName === 'chrome' ? [
          '--lang=ja-JP', 
          '--font-render-hinting=none',
          '--disable-autofill',
          '--disable-save-password-bubble',
          '--disable-password-generation'
        ] : []
      });

      // コンテキスト作成（録画機能付き）
      const videosDir = path.join(process.cwd(), 'recordings');
      if (!fs.existsSync(videosDir)) {
        fs.mkdirSync(videosDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const videoPath = path.join(videosDir, `recording-${timestamp}.webm`);

      const context = await browser.newContext({
        locale: 'ja-JP',
        timezoneId: 'Asia/Tokyo',
        ignoreHTTPSErrors: true,
        bypassCSP: true,
        recordVideo: this.options.video !== false ? {
          dir: videosDir,
          size: { width: 1280, height: 720 }
        } : undefined
      });

      const page = await context.newPage();

      // イベントリスナーの設定
      await this.setupRecordingListeners(page, cleanUrl);

      spinner.text = `${cleanUrl} にアクセス中...`;
      
      // 初期ステップ：URLアクセス（タイムアウトとwaitUntilを調整）
      try {
        await page.goto(cleanUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 60000 
        });
        await page.waitForTimeout(2000);
      } catch (error) {
        if (error.name === 'TimeoutError') {
          console.log(chalk.yellow('\n⚠️ ページの読み込みに時間がかかりましたが、録画を続行します'));
        } else {
          throw error;
        }
      }
      this.recordedSteps.push({
        step_number: this.recordedSteps.length + 1,
        action: 'navigate',
        target: cleanUrl,
        description: 'ページにアクセスする',
        timestamp: new Date().toISOString()
      });

      // 初期スクリーンショット
      await this.captureScreenshot(page, 'initial');

      spinner.succeed('録画準備完了！ブラウザで操作を開始してください');

      // ブラウザが閉じられるまで待機
      await new Promise((resolve) => {
        browser.on('disconnected', () => {
          // インターバルをクリア
          if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
          }
          resolve();
        });
        
        // Ctrl+C でも終了できるようにする
        process.on('SIGINT', async () => {
          console.log(chalk.yellow('\n\n録画を終了しています...'));
          // インターバルをクリア
          if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
          }
          await browser.close();
          resolve();
        });
      });

      // 録画を保存
      if (this.options.video !== false) {
        await context.close();
        console.log(chalk.green(`✅ 録画保存: ${videoPath}`));
      }

      // 録画データをファイルに保存
      await this.saveRecordingData();

      // テストケースを生成
      const testCase = await this.generateTestCaseFromRecording();
      
      // テストケースを保存
      await this.saveTestCase(testCase);

      console.log(chalk.green('\n✅ テストケースの録画と生成が完了しました！'));
      
      return testCase;

    } catch (error) {
      spinner.fail('録画エラー');
      console.error(chalk.red('エラー:'), error.message);
      throw error;
    }
  }

  async setupRecordingListeners(page, baseUrl) {
    // ページ内でイベントを監視するスクリプトを注入
    await page.evaluate(() => {
      window.__recordedActions = [];
      
      // クリックイベントの監視
      document.addEventListener('click', (e) => {
        const target = e.target;
        const tagName = target.tagName.toLowerCase();
        const text = target.textContent?.trim().substring(0, 30) || '';
        const id = target.id;
        const className = target.className;
        
        window.__recordedActions.push({
          type: 'click',
          tagName,
          text,
          id,
          className,
          timestamp: new Date().toISOString()
        });
      }, true);
      
      // 入力イベントの監視
      document.addEventListener('input', (e) => {
        const target = e.target;
        if (target.tagName.toLowerCase() === 'input' || target.tagName.toLowerCase() === 'textarea') {
          window.__recordedActions.push({
            type: 'input',
            tagName: target.tagName.toLowerCase(),
            name: target.name,
            id: target.id,
            value: target.value,
            timestamp: new Date().toISOString()
          });
        }
      }, true);
      
      // セレクトボックスの変更監視
      document.addEventListener('change', (e) => {
        const target = e.target;
        if (target.tagName.toLowerCase() === 'select') {
          window.__recordedActions.push({
            type: 'select',
            name: target.name,
            id: target.id,
            value: target.value,
            timestamp: new Date().toISOString()
          });
        }
      }, true);
    });
    
    // 定期的にアクションを取得
    const recordingInterval = setInterval(async () => {
      try {
        const actions = await page.evaluate(() => {
          const recorded = window.__recordedActions || [];
          window.__recordedActions = [];
          return recorded;
        });
        
        for (const action of actions) {
          if (action.type === 'click') {
            const selector = action.id ? `#${action.id}` : 
                           action.className ? `.${action.className.split(' ')[0]}` :
                           `${action.tagName}:has-text("${action.text}")`;
            
            this.recordedSteps.push({
              step_number: this.recordedSteps.length + 1,
              action: 'click',
              target: selector,
              description: `「${action.text || selector}」をクリック`,
              timestamp: action.timestamp
            });
            
            await this.captureScreenshot(page, `step-${this.recordedSteps.length}`);
          } else if (action.type === 'input') {
            const selector = action.id ? `#${action.id}` : 
                           action.name ? `[name="${action.name}"]` :
                           action.tagName;
            
            this.recordedSteps.push({
              step_number: this.recordedSteps.length + 1,
              action: 'fill',
              target: selector,
              value: action.value,
              description: `${action.name || action.id || 'フィールド'}に「${action.value}」を入力`,
              timestamp: action.timestamp
            });
          } else if (action.type === 'select') {
            const selector = action.id ? `#${action.id}` : 
                           action.name ? `[name="${action.name}"]` :
                           'select';
            
            this.recordedSteps.push({
              step_number: this.recordedSteps.length + 1,
              action: 'select',
              target: selector,
              value: action.value,
              description: `${action.name || action.id || 'セレクトボックス'}で「${action.value}」を選択`,
              timestamp: action.timestamp
            });
          }
        }
      } catch (error) {
        // ページが閉じられた場合などのエラーを無視
      }
    }, 500);
    
    // ナビゲーションイベント
    page.on('framenavigated', async (frame) => {
      if (frame === page.mainFrame()) {
        const currentUrl = page.url();
        if (currentUrl !== baseUrl) {
          this.recordedSteps.push({
            step_number: this.recordedSteps.length + 1,
            action: 'navigate',
            target: currentUrl,
            description: '新しいページに遷移',
            timestamp: new Date().toISOString()
          });

          await this.captureScreenshot(page, `navigate-${this.recordedSteps.length}`);
        }
      }
    });
    
    // クリーンアップのためにインターバルを保存
    this.recordingInterval = recordingInterval;
  }

  async getSelector(element) {
    // 要素のセレクタを取得（優先順位: id > name > class > text）
    const id = await element.getAttribute('id');
    if (id) return `#${id}`;

    const name = await element.getAttribute('name');
    if (name) return `[name="${name}"]`;

    const className = await element.getAttribute('class');
    if (className) {
      const classes = className.split(' ').filter(c => c.length > 0);
      if (classes.length > 0) return `.${classes[0]}`;
    }

    const tagName = await element.tagName();
    const text = await element.textContent();
    if (text) {
      return `${tagName.toLowerCase()}:has-text("${text.substring(0, 30)}")`;
    }

    return tagName.toLowerCase();
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
    
    this.screenshots.push(`screenshots/${filename}`);
    return `screenshots/${filename}`;
  }

  async generateTestCaseFromRecording() {
    console.log(chalk.cyan('\n📝 録画からテストケースを生成中...\n'));

    // テストケース情報を入力
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'テストケース名:',
        default: `録画テスト_${new Date().toISOString().slice(0, 10)}`
      },
      {
        type: 'input',
        name: 'category',
        message: 'カテゴリ:',
        default: 'UI操作'
      },
      {
        type: 'list',
        name: 'priority',
        message: '優先度:',
        choices: ['High', 'Medium', 'Low'],
        default: 'Medium'
      },
      {
        type: 'input',
        name: 'expectedResult',
        message: '期待結果:',
        default: '操作が正常に完了する'
      }
    ]);

    const testId = this.generateTestId();
    const credentials = this.config.test_targets?.[0]?.login_credentials;
    const baseUrl = this.recordedSteps[0]?.target || this.config.test_targets?.[0]?.base_url || 'http://localhost:3000';

    // 記録されたステップをクリーンアップ
    const cleanSteps = this.recordedSteps.map((step, index) => {
      let description = step.description;

      // 認証情報をマスクまたは置換
      if (step.value) {
        if (step.value === credentials?.user?.email || 
            step.value === credentials?.admin?.email) {
          description = description.replace(step.value, '${user.email}');
        } else if (step.value === credentials?.user?.password || 
                   step.value === credentials?.admin?.password) {
          description = description.replace(step.value, '${user.password}');
        }
      }

      return {
        step_number: index + 1,
        action: step.action,
        target: step.target,
        value: step.value,
        description: description
      };
    });

    // Playwrightコードを生成
    const playwrightCode = this.generatePlaywrightCode(cleanSteps, baseUrl);

    return {
      test_id: testId,
      test_category: answers.category,
      test_case_name: answers.name,
      priority: answers.priority,
      target_url: baseUrl,
      preconditions: `${baseUrl}にアクセス可能`,
      test_steps: cleanSteps,
      expected_result: answers.expectedResult,
      test_data: {
        generated_by: '録画モード',
        source_url: baseUrl,
        generation_date: new Date().toISOString(),
        recording_duration: this.calculateDuration()
      },
      generated_playwright_code: playwrightCode,
      screenshots: this.screenshots,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString()
    };
  }

  generatePlaywrightCode(steps, baseUrl) {
    let code = `// テストケース: ${steps.length}ステップ\n`;
    code += `test('録画されたテスト', async ({ page }) => {\n`;
    
    steps.forEach(step => {
      switch (step.action) {
        case 'navigate':
          code += `  await page.goto('${step.target}');\n`;
          break;
        case 'click':
          code += `  await page.click('${step.target}');\n`;
          break;
        case 'fill':
          code += `  await page.fill('${step.target}', '${step.value || ''}');\n`;
          break;
        case 'select':
          code += `  await page.selectOption('${step.target}', '${step.value || ''}');\n`;
          break;
        default:
          code += `  // ${step.description}\n`;
      }
    });
    
    code += `});\n`;
    return code;
  }

  calculateDuration() {
    if (this.recordedSteps.length < 2) return '0秒';
    
    const start = new Date(this.recordedSteps[0].timestamp);
    const end = new Date(this.recordedSteps[this.recordedSteps.length - 1].timestamp);
    const durationMs = end - start;
    
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}分${seconds % 60}秒`;
    }
    return `${seconds}秒`;
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

  async saveTestCase(testCase) {
    this.testCases.test_cases.push(testCase);
    this.testCases.last_updated = new Date().toISOString();
    
    fs.writeFileSync(this.testCasesPath, JSON.stringify(this.testCases, null, 2), 'utf8');
    console.log(chalk.green(`✅ テストケース ${testCase.test_id} を保存しました`));
  }

  async saveRecordingData() {
    // 録画データの終了時刻を設定
    this.recording.endTime = new Date().toISOString();
    
    // 録画名を設定（URLから生成）
    if (!this.recording.name) {
      const urlObj = new URL(this.recording.url);
      this.recording.name = `${urlObj.hostname} 録画 - ${new Date().toLocaleString()}`;
    }
    
    // 録画データにアクションを追加
    this.recording.actions = this.recording.actions || [];
    
    // recordedStepsがある場合は、それをactionsに変換
    if (this.recordedSteps && this.recordedSteps.length > 0) {
      this.recordedSteps.forEach(step => {
        this.recording.actions.push({
          type: step.action,
          target: step.target,
          value: step.value,
          description: step.description,
          timestamp: step.timestamp,
          xpath: step.target // XPathとしても保存
        });
      });
    }
    
    // スクリーンショットを追加
    this.recording.screenshots = this.screenshots || [];
    
    // ファイル名を生成
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `recording-${timestamp}.json`;
    const filepath = path.join(process.cwd(), 'recordings', filename);
    
    // ディレクトリが存在しない場合は作成
    const recordingsDir = path.join(process.cwd(), 'recordings');
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true });
    }
    
    // 録画データを保存
    fs.writeFileSync(filepath, JSON.stringify(this.recording, null, 2), 'utf8');
    console.log(chalk.green(`📹 録画データを保存しました: recordings/${filename}`));
    
    return filename;
  }

  async listRecordings() {
    const recordingsDir = path.join(process.cwd(), 'recordings');
    
    if (!fs.existsSync(recordingsDir)) {
      console.log(chalk.yellow('⚠️  録画ファイルがありません'));
      return;
    }

    const files = fs.readdirSync(recordingsDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filepath = path.join(recordingsDir, file);
        const stats = fs.statSync(filepath);
        
        try {
          const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
          
          return {
            filename: file,
            name: content.name || 'Unnamed',
            url: content.url,
            actions: content.actions?.length || 0,
            created: stats.mtime,
            size: (stats.size / 1024).toFixed(1) + ' KB'
          };
        } catch (error) {
          // JSONパースエラーの場合はスキップ
          return null;
        }
      })
      .filter(file => file !== null)
      .sort((a, b) => b.created - a.created);

    if (files.length === 0) {
      console.log(chalk.yellow('⚠️  録画ファイルがありません'));
      return;
    }

    console.log(chalk.cyan('\n📹 録画済みファイル一覧\n'));
    console.log(chalk.gray('─'.repeat(80)));
    
    files.forEach((file, index) => {
      console.log(`${chalk.cyan(`[${index + 1}]`)} ${chalk.white(file.filename)}`);
      console.log(`    ${chalk.gray('名前:')} ${file.name}`);
      console.log(`    ${chalk.gray('URL:')} ${file.url}`);
      console.log(`    ${chalk.gray('アクション数:')} ${file.actions}`);
      console.log(`    ${chalk.gray('作成日時:')} ${file.created.toLocaleString()}`);
      console.log(`    ${chalk.gray('サイズ:')} ${file.size}`);
      console.log();
    });
  }

  async playRecording(filename, options = {}) {
    // ファイル拡張子をチェック
    if (!filename.endsWith('.json')) {
      console.error(chalk.red(`❌ JSONファイルを指定してください。動画ファイル（.webm）ではなく、録画データファイル（.json）が必要です`));
      console.log(chalk.yellow(`ヒント: ./web-test play --list で利用可能な録画ファイルを確認してください`));
      return;
    }
    
    const recordingPath = path.join(process.cwd(), 'recordings', filename);
    
    if (!fs.existsSync(recordingPath)) {
      console.error(chalk.red(`❌ ファイルが見つかりません: ${filename}`));
      return;
    }

    const recording = JSON.parse(fs.readFileSync(recordingPath, 'utf8'));
    const spinner = ora('再生準備中...').start();

    const browser = await chromium.launch({ 
      headless: options.headless || false,
      slowMo: 500 / (options.speed || 1) 
    });
    
    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        recordVideo: {
          dir: path.join(process.cwd(), 'recordings', 'videos'),
          size: { width: 1280, height: 720 }
        }
      });

      const page = await context.newPage();
      spinner.text = '録画内容を再生中...';

      // アクションを再生
      for (const action of recording.actions) {
        spinner.text = `実行中: ${action.type} - ${action.description || ''}`;
        
        try {
          switch (action.type) {
            case 'navigation':
            case 'navigate':
              try {
                await page.goto(action.url || action.target, { 
                  waitUntil: 'domcontentloaded',
                  timeout: 60000 
                });
                await page.waitForTimeout(1000);
              } catch (navError) {
                if (navError.name === 'TimeoutError') {
                  console.log(chalk.yellow(`⚠️ ページ読み込みタイムアウト: ${action.url || action.target}`));
                } else {
                  throw navError;
                }
              }
              break;
              
            case 'click':
              await page.click(action.xpath || action.target);
              break;
              
            case 'input':
            case 'fill':
              await page.fill(action.xpath || action.target, action.value || '');
              break;
              
            case 'select':
              await page.selectOption(action.xpath || action.target, action.value || '');
              break;
              
            default:
              console.log(chalk.gray(`  ⏭️  不明なアクション: ${action.type}`));
          }
          
          // 各アクション後に少し待機
          await page.waitForTimeout(1000 / (options.speed || 1));
        } catch (error) {
          console.error(chalk.yellow(`⚠️  アクション実行エラー: ${error.message}`));
        }
      }

      spinner.succeed('再生完了！');
      
      // 最後の状態を少し表示
      await page.waitForTimeout(3000);
      
      // テストケース生成の確認
      if (options.noGenerate !== true) {
        if (options.autoGenerate) {
          // 自動生成モード：デフォルト値で生成
          await this.generateTestCaseFromRecordingFile(recording, filename, true);
        } else {
          // 対話式モード
          const generateAnswer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'generate',
              message: 'この録画からテストケースを生成しますか？',
              default: true
            }
          ]);
          
          if (generateAnswer.generate) {
            await this.generateTestCaseFromRecordingFile(recording, filename);
          }
        }
      }
      
    } catch (error) {
      spinner.fail('再生中にエラーが発生しました');
      console.error(chalk.red(error.message));
    } finally {
      await browser.close();
    }
  }

  async interactivePlayback() {
    const recordingsDir = path.join(process.cwd(), 'recordings');
    
    if (!fs.existsSync(recordingsDir)) {
      console.log(chalk.yellow('⚠️  録画ファイルがありません'));
      return;
    }

    const files = fs.readdirSync(recordingsDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const content = JSON.parse(fs.readFileSync(path.join(recordingsDir, file), 'utf8'));
        return {
          name: `${file} - ${content.name || 'Unnamed'} (${content.actions?.length || 0} actions)`,
          value: file
        };
      });

    if (files.length === 0) {
      console.log(chalk.yellow('⚠️  録画ファイルがありません'));
      return;
    }

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'file',
        message: '再生する録画を選択してください:',
        choices: files
      },
      {
        type: 'number',
        name: 'speed',
        message: '再生速度 (0.5-5):',
        default: 1,
        validate: (value) => value >= 0.5 && value <= 5
      },
      {
        type: 'confirm',
        name: 'headless',
        message: 'ヘッドレスモードで実行しますか？',
        default: false
      }
    ]);

    await this.playRecording(answers.file, {
      speed: answers.speed,
      headless: answers.headless
    });
  }

  async generateTestCaseFromRecordingFile(recording, filename, useDefaults = false) {
    console.log(chalk.cyan('\n📝 録画からテストケースを生成中...\n'));

    // デフォルト値を使用するか、対話式入力を行うか
    const answers = useDefaults ? {
      name: recording.name || 'Untitled Test',
      category: 'E2Eテスト',
      priority: '中',
      expectedResult: '操作が正常に完了すること'
    } : await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'テストケース名:',
        default: recording.name || 'Untitled Test'
      },
      {
        type: 'list',
        name: 'category',
        message: 'カテゴリー:',
        choices: ['機能テスト', 'UIテスト', '統合テスト', 'E2Eテスト', 'その他'],
        default: 'E2Eテスト'
      },
      {
        type: 'list',
        name: 'priority',
        message: '優先度:',
        choices: ['高', '中', '低'],
        default: '中'
      },
      {
        type: 'input',
        name: 'expectedResult',
        message: '期待結果:',
        default: '操作が正常に完了すること'
      }
    ]);

    // アクションをテストステップに変換
    const testSteps = recording.actions.map((action, index) => {
      let description = action.description || '';
      
      // ステップの説明を生成
      if (!description) {
        switch (action.type) {
          case 'navigation':
          case 'navigate':
            description = `${action.url || action.target}にアクセスする`;
            break;
          case 'click':
            description = `${action.target}をクリック`;
            break;
          case 'input':
          case 'fill':
            description = `${action.target}に「${action.value}」を入力`;
            break;
          case 'select':
            description = `${action.target}で「${action.value}」を選択`;
            break;
          default:
            description = action.type;
        }
      }

      return {
        step_number: index + 1,
        action: action.type,
        target: action.target || action.xpath,
        value: action.value,
        description: description
      };
    });

    // Playwrightコードを生成
    const playwrightCode = this.generatePlaywrightCode(testSteps, recording.url);

    // テストケースIDを生成
    const testId = this.generateTestId();

    const testCase = {
      test_id: testId,
      test_category: answers.category,
      test_case_name: answers.name,
      priority: answers.priority,
      target_url: recording.url,
      preconditions: `${recording.url}にアクセス可能`,
      test_steps: testSteps,
      expected_result: answers.expectedResult,
      test_data: {
        generated_by: '録画モード',
        source_file: filename,
        source_url: recording.url,
        generation_date: new Date().toISOString(),
        recording_duration: this.calculateDurationFromRecording(recording)
      },
      generated_playwright_code: playwrightCode,
      screenshots: recording.screenshots || [],
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString()
    };

    // テストケースを保存
    await this.saveTestCase(testCase);

    console.log(chalk.green('\n✅ テストケースの生成が完了しました！'));
    console.log(chalk.cyan(`テストケースID: ${testId}`));
    
    return testCase;
  }

  calculateDurationFromRecording(recording) {
    if (!recording.startTime || !recording.endTime) return '不明';
    
    const start = new Date(recording.startTime);
    const end = new Date(recording.endTime);
    const durationMs = end - start;
    
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}分${seconds % 60}秒`;
    }
    return `${seconds}秒`;
  }
}

export default TestCaseRecorder;