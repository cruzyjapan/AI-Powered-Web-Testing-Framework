import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ConfigManager {
  constructor() {
    this.configPath = path.join(process.cwd(), 'config', 'settings.json');
    this.testCasesPath = path.join(process.cwd(), 'config', 'test-cases.json');
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(data);
      }
      console.log(chalk.yellow('⚠️  設定ファイルが見つかりません。デフォルト設定を使用します。'));
      return this.getDefaultConfig();
    } catch (error) {
      console.error(chalk.red('❌ 設定ファイルの読み込みエラー:'), error.message);
      return this.getDefaultConfig();
    }
  }

  getDefaultConfig() {
    return {
      project_name: 'WebTestAI',
      version: '1.0.0',
      ai_cli_settings: {
        default_cli: 'gemini',
        gemini: {
          enabled: true,
          model: 'gemini-2.5-pro',
          timeout: 300,
          auto_extend: true,
          max_timeout: 3600
        },
        claude: {
          enabled: true,
          model: 'claude-sonnet-4',
          timeout: 300,
          auto_extend: true,
          max_timeout: 3600
        }
      },
      test_targets: [
        {
          name: 'ローカルWebサイト',
          base_url: 'http://localhost:3000',
          admin_url: 'http://localhost:3000/admin',
          basic_auth: {
            enabled: false,
            username: '',
            password: ''
          },
          login_credentials: {
            admin: {
              email: 'admin@example.com',
              password: 'password'
            },
            user: {
              email: 'user@example.com',
              password: 'password'
            }
          }
        }
      ],
      test_options: {
        screenshot_enabled: true,
        video_enabled: false,
        trace_enabled: false,  // トレースはデフォルトで無効（必要時のみ有効化）
        retry_count: 2,
        timeout: 30000,
        headless: false
      },
      output_settings: {
        formats: ['csv', 'excel', 'html'],
        screenshot_quality: 90,
        report_title: '自動テスト実行結果'
      },
      test_sheet_format: {
        project_name: 'WebTestAIプロジェクト',
        version: '1.0.0',
        tester_name: 'AI自動テスト',
        test_phase: '結合テスト'
      }
    };
  }

  saveConfig() {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
      console.log(chalk.green('✅ 設定を保存しました'));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ 設定保存エラー:'), error.message);
      return false;
    }
  }

  async switchDefaultCli(cli) {
    const validClis = ['gemini', 'claude', 'auto'];
    
    if (!validClis.includes(cli)) {
      console.log(chalk.red(`❌ 無効なCLI: ${cli}`));
      console.log(chalk.yellow(`有効なCLI: ${validClis.join(', ')}`));
      return;
    }

    if (cli !== 'auto') {
      if (!this.config.ai_cli_settings[cli].enabled) {
        console.log(chalk.yellow(`⚠️  ${cli} CLIは無効になっています`));
        const { enableCli } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'enableCli',
            message: `${cli} CLIを有効にしますか？`,
            default: true
          }
        ]);

        if (enableCli) {
          this.config.ai_cli_settings[cli].enabled = true;
        } else {
          return;
        }
      }
    }

    this.config.ai_cli_settings.default_cli = cli;
    
    if (this.saveConfig()) {
      console.log(chalk.green(`✅ デフォルトCLIを ${cli} に切り替えました`));
    }
  }

  async showConfigUI() {
    console.log(chalk.cyan('\n📋 WebTestAI 設定管理\n'));

    const choices = [
      '1. プロジェクト情報',
      '2. AI CLI設定',
      '3. テスト対象サイト設定',
      '4. テストオプション',
      '5. 出力設定',
      '6. テストシート形式',
      '7. 設定をリセット',
      '8. 終了'
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '設定項目を選択してください:',
        choices
      }
    ]);

    switch (action.charAt(0)) {
      case '1':
        await this.configureProject();
        break;
      case '2':
        await this.configureAICli();
        break;
      case '3':
        await this.configureTestTarget();
        break;
      case '4':
        await this.configureTestOptions();
        break;
      case '5':
        await this.configureOutput();
        break;
      case '6':
        await this.configureTestSheet();
        break;
      case '7':
        await this.resetConfig();
        break;
      case '8':
        console.log(chalk.green('✅ 設定を終了しました'));
        return;
    }

    await this.showConfigUI();
  }

  async configureProject() {
    console.log(chalk.cyan('\n📝 プロジェクト情報設定\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'project_name',
        message: 'プロジェクト名:',
        default: this.config.project_name
      },
      {
        type: 'input',
        name: 'version',
        message: 'バージョン:',
        default: this.config.version
      }
    ]);

    this.config.project_name = answers.project_name;
    this.config.version = answers.version;
    
    this.saveConfig();
  }

  async configureAICli() {
    console.log(chalk.cyan('\n🤖 AI CLI設定\n'));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'default_cli',
        message: 'デフォルトCLI:',
        choices: ['gemini', 'claude', 'auto'],
        default: this.config.ai_cli_settings.default_cli
      },
      {
        type: 'confirm',
        name: 'gemini_enabled',
        message: 'Gemini CLIを有効化:',
        default: this.config.ai_cli_settings.gemini.enabled
      },
      {
        type: 'input',
        name: 'gemini_model',
        message: 'Geminiモデル:',
        default: this.config.ai_cli_settings.gemini.model,
        when: (answers) => answers.gemini_enabled
      },
      {
        type: 'confirm',
        name: 'claude_enabled',
        message: 'Claude CLIを有効化:',
        default: this.config.ai_cli_settings.claude.enabled
      },
      {
        type: 'input',
        name: 'claude_model',
        message: 'Claudeモデル:',
        default: this.config.ai_cli_settings.claude.model,
        when: (answers) => answers.claude_enabled
      }
    ]);

    this.config.ai_cli_settings.default_cli = answers.default_cli;
    this.config.ai_cli_settings.gemini.enabled = answers.gemini_enabled;
    if (answers.gemini_model) {
      this.config.ai_cli_settings.gemini.model = answers.gemini_model;
    }
    this.config.ai_cli_settings.claude.enabled = answers.claude_enabled;
    if (answers.claude_model) {
      this.config.ai_cli_settings.claude.model = answers.claude_model;
    }

    this.saveConfig();
  }

  async configureTestTarget() {
    console.log(chalk.cyan('\n🎯 テスト対象サイト設定\n'));

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '操作を選択:',
        choices: [
          '既存のターゲットを編集',
          '新規ターゲットを追加',
          'ターゲットを削除',
          'キャンセル'
        ]
      }
    ]);

    if (action === 'キャンセル') {
      return;
    }

    if (action === '新規ターゲットを追加') {
      await this.addTestTarget();
    } else if (action === '既存のターゲットを編集') {
      await this.editTestTarget();
    } else if (action === 'ターゲットを削除') {
      await this.deleteTestTarget();
    }

    this.saveConfig();
  }

  async addTestTarget() {
    const newTarget = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'ターゲット名:',
        validate: (input) => input.length > 0 || '名前を入力してください'
      },
      {
        type: 'input',
        name: 'base_url',
        message: 'ベースURL:',
        default: 'http://localhost:3000'
      },
      {
        type: 'input',
        name: 'admin_url',
        message: '管理画面URL:',
        default: 'http://localhost:3000/admin'
      },
      {
        type: 'confirm',
        name: 'basic_auth_enabled',
        message: 'Basic認証を使用しますか？',
        default: false
      },
      {
        type: 'input',
        name: 'basic_auth_username',
        message: 'Basic認証ユーザー名:',
        when: (answers) => answers.basic_auth_enabled
      },
      {
        type: 'password',
        name: 'basic_auth_password',
        message: 'Basic認証パスワード:',
        when: (answers) => answers.basic_auth_enabled
      },
      {
        type: 'input',
        name: 'admin_email',
        message: '管理者メールアドレス:',
        default: 'admin@example.com'
      },
      {
        type: 'password',
        name: 'admin_password',
        message: '管理者パスワード:',
        default: 'password'
      },
      {
        type: 'input',
        name: 'user_email',
        message: 'ユーザーメールアドレス:',
        default: 'user@example.com'
      },
      {
        type: 'password',
        name: 'user_password',
        message: 'ユーザーパスワード:',
        default: 'password'
      }
    ]);

    const target = {
      name: newTarget.name,
      base_url: newTarget.base_url,
      admin_url: newTarget.admin_url,
      basic_auth: {
        enabled: newTarget.basic_auth_enabled || false,
        username: newTarget.basic_auth_username || '',
        password: newTarget.basic_auth_password || ''
      },
      login_credentials: {
        admin: {
          email: newTarget.admin_email,
          password: newTarget.admin_password
        },
        user: {
          email: newTarget.user_email,
          password: newTarget.user_password
        }
      }
    };

    this.config.test_targets.push(target);
    console.log(chalk.green(`✅ ターゲット "${target.name}" を追加しました`));
  }

  async editTestTarget() {
    if (this.config.test_targets.length === 0) {
      console.log(chalk.yellow('⚠️  編集するターゲットがありません'));
      return;
    }

    const { targetIndex } = await inquirer.prompt([
      {
        type: 'list',
        name: 'targetIndex',
        message: '編集するターゲットを選択:',
        choices: this.config.test_targets.map((t, i) => ({
          name: `${t.name} (${t.base_url})`,
          value: i
        }))
      }
    ]);

    const target = this.config.test_targets[targetIndex];
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'ターゲット名:',
        default: target.name
      },
      {
        type: 'input',
        name: 'base_url',
        message: 'ベースURL:',
        default: target.base_url
      },
      {
        type: 'input',
        name: 'admin_url',
        message: '管理画面URL:',
        default: target.admin_url
      }
    ]);

    Object.assign(target, answers);
    console.log(chalk.green(`✅ ターゲット "${target.name}" を更新しました`));
  }

  async deleteTestTarget() {
    if (this.config.test_targets.length === 0) {
      console.log(chalk.yellow('⚠️  削除するターゲットがありません'));
      return;
    }

    const { targetIndex } = await inquirer.prompt([
      {
        type: 'list',
        name: 'targetIndex',
        message: '削除するターゲットを選択:',
        choices: this.config.test_targets.map((t, i) => ({
          name: `${t.name} (${t.base_url})`,
          value: i
        }))
      }
    ]);

    const targetName = this.config.test_targets[targetIndex].name;
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `本当に "${targetName}" を削除しますか？`,
        default: false
      }
    ]);

    if (confirm) {
      this.config.test_targets.splice(targetIndex, 1);
      console.log(chalk.green(`✅ ターゲット "${targetName}" を削除しました`));
    }
  }

  async configureTestOptions() {
    console.log(chalk.cyan('\n⚙️ テストオプション設定\n'));

    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'screenshot_enabled',
        message: 'スクリーンショット有効化:',
        default: this.config.test_options.screenshot_enabled
      },
      {
        type: 'confirm',
        name: 'video_enabled',
        message: 'ビデオ録画有効化:',
        default: this.config.test_options.video_enabled
      },
      {
        type: 'confirm',
        name: 'trace_enabled',
        message: 'トレース有効化:',
        default: this.config.test_options.trace_enabled
      },
      {
        type: 'number',
        name: 'retry_count',
        message: 'リトライ回数:',
        default: this.config.test_options.retry_count
      },
      {
        type: 'number',
        name: 'timeout',
        message: 'タイムアウト時間(ミリ秒):',
        default: this.config.test_options.timeout
      },
      {
        type: 'confirm',
        name: 'headless',
        message: 'ヘッドレスモード:',
        default: this.config.test_options.headless
      }
    ]);

    Object.assign(this.config.test_options, answers);
    this.saveConfig();
  }

  async configureOutput() {
    console.log(chalk.cyan('\n📊 出力設定\n'));

    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'formats',
        message: '出力形式を選択:',
        choices: [
          { name: 'CSV', value: 'csv', checked: this.config.output_settings.formats.includes('csv') },
          { name: 'Excel', value: 'excel', checked: this.config.output_settings.formats.includes('excel') },
          { name: 'HTML', value: 'html', checked: this.config.output_settings.formats.includes('html') }
        ]
      },
      {
        type: 'number',
        name: 'screenshot_quality',
        message: 'スクリーンショット品質 (1-100):',
        default: this.config.output_settings.screenshot_quality,
        validate: (input) => input >= 1 && input <= 100 || '1-100の範囲で入力してください'
      },
      {
        type: 'input',
        name: 'report_title',
        message: 'レポートタイトル:',
        default: this.config.output_settings.report_title
      }
    ]);

    Object.assign(this.config.output_settings, answers);
    this.saveConfig();
  }

  async configureTestSheet() {
    console.log(chalk.cyan('\n📄 テストシート形式設定\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'project_name',
        message: 'プロジェクト名:',
        default: this.config.test_sheet_format.project_name
      },
      {
        type: 'input',
        name: 'version',
        message: 'バージョン:',
        default: this.config.test_sheet_format.version
      },
      {
        type: 'input',
        name: 'tester_name',
        message: 'テスター名:',
        default: this.config.test_sheet_format.tester_name
      },
      {
        type: 'input',
        name: 'test_phase',
        message: 'テストフェーズ:',
        default: this.config.test_sheet_format.test_phase
      }
    ]);

    Object.assign(this.config.test_sheet_format, answers);
    this.saveConfig();
  }

  async resetConfig() {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '本当に設定をリセットしますか？',
        default: false
      }
    ]);

    if (confirm) {
      this.config = this.getDefaultConfig();
      if (this.saveConfig()) {
        console.log(chalk.green('✅ 設定をリセットしました'));
      }
    }
  }

  getTestTarget(name) {
    if (!name) {
      return this.config.test_targets[0];
    }
    return this.config.test_targets.find(t => t.name === name) || this.config.test_targets[0];
  }

  get(key) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  set(key, val) {
    const keys = key.split('.');
    let target = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!target[k] || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k];
    }
    
    target[keys[keys.length - 1]] = val;
    this.saveConfig();
  }
}

export default ConfigManager;