import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import ConfigManager from './config-manager.js';
import CLIManager from './cli-manager.js';

/**
 * テストケース最適化クラス
 * AI CLIを使用してテストケースをレビューし、最適化する
 */
class TestCaseOptimizer {
  constructor(options = {}) {
    this.options = options;
    this.configManager = new ConfigManager();
    this.config = this.configManager.config;
    this.cliManager = new CLIManager(this.config);
    this.testCasesPath = path.join(process.cwd(), 'config', 'test-cases.json');
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

  /**
   * テストケースを読み込む
   */
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

  /**
   * テストケースを保存する
   */
  saveTestCases(testCases) {
    try {
      const dir = path.dirname(this.testCasesPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // バックアップを作成
      if (fs.existsSync(this.testCasesPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const backupPath = path.join(dir, `test-cases-backup-before-optimization-${timestamp}.json`);
        fs.copyFileSync(this.testCasesPath, backupPath);
        console.log(chalk.gray(`📁 バックアップ作成: ${backupPath}`));
      }
      
      testCases.last_updated = this.getJSTTimestamp();
      fs.writeFileSync(this.testCasesPath, JSON.stringify(testCases, null, 2), 'utf8');
      console.log(chalk.green('✅ 最適化されたテストケースを保存しました'));
      return true;
    } catch (error) {
      console.error(chalk.red('テストケース保存エラー:'), error.message);
      return false;
    }
  }

  /**
   * テストケースをレビュー・最適化する
   */
  async reviewAndOptimize() {
    console.log(chalk.cyan('\n🔍 テストケースレビュー・最適化を開始\n'));
    
    const testCases = this.loadTestCases();
    
    if (!testCases.test_cases || testCases.test_cases.length === 0) {
      console.log(chalk.yellow('⚠️  テストケースが見つかりません'));
      return;
    }
    
    console.log(chalk.blue(`📋 ${testCases.test_cases.length}件のテストケースを分析中...\n`));
    
    // カテゴリ別に分類
    const categorized = this.categorizeTestCases(testCases.test_cases);
    this.showCategorySummary(categorized);
    
    // レビュー方法を選択 (コマンドラインオプションがある場合はそれを使用)
    let reviewMode;
    
    if (this.options?.mode && this.options.mode !== 'auto') {
      // モードマッピング
      const modeMap = {
        'cleanup': 'delete',
        'delete': 'delete',
        'category': 'category', 
        'priority': 'priority',
        'security': 'security',
        'full': 'full',
        'auto': 'auto'
      };
      reviewMode = modeMap[this.options.mode] || 'auto';
      console.log(chalk.blue(`📌 モード: ${reviewMode} (コマンドラインから指定)\n`));
    } else {
      const prompt = await inquirer.prompt([
        {
          type: 'list',
          name: 'reviewMode',
        message: 'レビューモードを選択してください:',
        choices: [
          { name: '🚀 自動最適化（推奨）', value: 'auto' },
          { name: '📊 カテゴリ別最適化', value: 'category' },
          { name: '🎯 優先度別最適化', value: 'priority' },
          { name: '🔒 セキュリティテスト最適化', value: 'security' },
          { name: '🗑️  重複・無効テスト削除', value: 'cleanup' },
          { name: '✨ 完全レビュー（時間がかかります）', value: 'full' }
        ]
      }
    ]);
      reviewMode = prompt.reviewMode;
    }
    
    let optimizedTestCases;
    
    switch (reviewMode) {
      case 'auto':
        optimizedTestCases = await this.autoOptimize(testCases);
        break;
      case 'category':
        optimizedTestCases = await this.optimizeByCategory(testCases, categorized);
        break;
      case 'priority':
        optimizedTestCases = await this.optimizeByPriority(testCases);
        break;
      case 'security':
        optimizedTestCases = await this.optimizeSecurityTests(testCases);
        break;
      case 'cleanup':
      case 'delete':
        optimizedTestCases = await this.cleanupTests(testCases);
        break;
      case 'full':
        optimizedTestCases = await this.fullReview(testCases);
        break;
      default:
        optimizedTestCases = testCases;
    }
    
    // 最適化結果を表示
    this.showOptimizationResults(testCases, optimizedTestCases);
    
    // 保存確認 (--auto-saveオプションがある場合は自動保存)
    const autoSave = this.options?.autoSave || process.argv.includes('--auto-save');
    
    if (autoSave) {
      console.log(chalk.blue('🔄 自動保存モード: テストケースを保存します'));
      this.saveTestCases(optimizedTestCases);
    } else {
      const { shouldSave } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldSave',
          message: '最適化されたテストケースを保存しますか？',
          default: true
        }
      ]);
      
      if (shouldSave) {
        this.saveTestCases(optimizedTestCases);
      } else {
        console.log(chalk.yellow('💾 保存をキャンセルしました'));
      }
    }
  }

  /**
   * 自動最適化
   */
  async autoOptimize(testCases) {
    const spinner = ora('AI CLIで自動最適化中...').start();
    
    try {
      // 明らかな重複を削除
      let optimized = this.removeDuplicates(testCases.test_cases);
      
      // 無効なテストケースを削除
      optimized = this.removeInvalidTests(optimized);
      
      // 優先度を再評価
      optimized = await this.reevaluatePriorities(optimized);
      
      // カテゴリを整理
      optimized = this.reorganizeCategories(optimized);
      
      // テストデータを改善
      optimized = await this.improveTestData(optimized);
      
      // 重要なフィールドが欠落している場合はデフォルト値を設定
      optimized = optimized.map(tc => ({
        ...tc,
        prerequisite: tc.prerequisite || 'ブラウザが起動している状態',
        test_steps: tc.test_steps && tc.test_steps.length > 0 ? tc.test_steps : [
          {
            step_number: 1,
            action: tc.action || 'navigate',
            target: tc.target_url || this.config.target_url,
            value: tc.value || '',
            description: tc.description || `${tc.test_case_name}を実行`
          }
        ],
        expected_result: tc.expected_result || `${tc.test_case_name}が正常に動作すること`
      }));
      
      spinner.succeed('自動最適化完了');
      
      return {
        ...testCases,
        test_cases: optimized,
        optimized_at: this.getJSTTimestamp(),
        optimization_mode: 'auto'
      };
    } catch (error) {
      spinner.fail('最適化エラー');
      console.error(chalk.red('エラー:'), error.message);
      return testCases;
    }
  }

  /**
   * 重複テストケースを削除
   */
  removeDuplicates(testCases) {
    const seen = new Map();
    const unique = [];
    
    for (const tc of testCases) {
      // テストケースの一意キーを生成
      const key = `${tc.test_category}_${tc.test_case_name}_${tc.target_url}_${tc.selector || ''}`;
      
      if (!seen.has(key)) {
        seen.set(key, true);
        unique.push(tc);
      } else {
        console.log(chalk.gray(`  🗑️  重複削除: ${tc.test_case_name}`));
      }
    }
    
    return unique;
  }

  /**
   * 無効なテストケースを削除
   */
  removeInvalidTests(testCases) {
    return testCases.filter(tc => {
      const name = tc.test_case_name || '';
      
      // 無効な条件をチェック
      const isInvalid = 
        // テストケース名が無効
        !name || 
        name === 'undefined' ||
        name.includes('undefined') ||
        // 単純すぎる名前
        /^(リンク|ボタン|入力|element)_?\d*$/.test(name) ||
        // 数字のみ、単一文字
        /^[\d\s]+$/.test(name) ||
        name.length <= 2 ||
        // ページネーションボタン
        /^\d+\s+of\s+\d+$/.test(name) ||
        /^button_\d+\s+of\s+\d+$/.test(name) ||
        // 価格表示（静的要素）
        /^[p|div|span]_[￥¥$]\d+/.test(name) ||
        /^[p|div|span]_\d+円/.test(name) ||
        // 日付表示（静的要素）
        /^[p|div|span]_\d{4}\/\d{2}\/\d{2}/.test(name) ||
        // 単純な要素タグ名のみ
        /^(a|div|span|p|button|input|select)_/.test(name) && name.split('_')[1]?.length <= 3 ||
        // 空のリンク
        name === 'リンク_' || name === 'ボタン_' ||
        // slick-slideなどのライブラリ固有クラス
        /slick-slide\d+/.test(name) ||
        // 重複するspan要素（aタグと同じテキストのspan）
        (tc.test_category === 'インタラクティブ' && /^span_/.test(name)) ||
        // p要素（段落テキスト）は通常インタラクティブではない
        (tc.test_category === 'インタラクティブ' && /^p_/.test(name)) ||
        // div要素で数字や価格のみ
        (tc.test_category === 'インタラクティブ' && /^div_[\d￥¥$]/.test(name)) ||
        // more、数字などの汎用的すぎる名前
        /^[a|button|div|span]_(more|\d+|￥\d+|¥\d+)$/.test(name) ||
        // inputで汎用的な説明
        /^input_(キーワードを入力|入力)$/.test(name) ||
        // selectで汎用的な説明
        /^select_(全ての|すべての)/.test(name);
      
      if (isInvalid) {
        console.log(chalk.gray(`  🗑️  無効削除: ${tc.test_case_name}`));
        return false;
      }
      
      // ステップ数が0のテストケースでも、有効な情報があれば保持
      // (前提条件や期待結果が設定されているか、特定のカテゴリのテストケースは保持)
      if (tc.test_steps && Array.isArray(tc.test_steps) && tc.test_steps.length === 0) {
        // フォーム、入力、セレクト、基本機能カテゴリは保持
        const keepCategories = ['フォーム', '入力', 'セレクト', '基本機能', 'フォーム機能', 'UI操作'];
        if (keepCategories.includes(tc.test_category)) {
          return true;
        }
        
        // 前提条件や期待結果が明確に設定されているものは保持
        if ((tc.prerequisite && tc.prerequisite !== 'null' && tc.prerequisite !== '') ||
            (tc.expected_result && tc.expected_result !== 'null' && tc.expected_result !== '')) {
          return true;
        }
        
        console.log(chalk.gray(`  🗑️  ステップなし削除: ${tc.test_case_name}`));
        return false;
      }
      
      // 汎用的すぎる期待結果のテストケースを削除
      const genericExpectedResults = [
        'a要素が正常に動作する',
        'button要素が正常に動作する',
        'input要素が正常に動作する',
        'select要素が正常に動作する',
        'div要素が正常に動作する',
        'span要素が正常に動作する',
        'form要素が正常に動作する',
        '要素が正常に動作する'
      ];
      
      if (tc.expected_result && genericExpectedResults.includes(tc.expected_result)) {
        // ステップ数が1以下で、汎用的な期待結果の場合は削除
        if (!tc.test_steps || tc.test_steps.length <= 1) {
          console.log(chalk.gray(`  🗑️  汎用的期待結果削除: ${tc.test_case_name}`));
          return false;
        }
      }
      
      // 前提条件がURLと同じで、ステップ数が少ない場合も削除
      if (tc.preconditions && tc.target_url) {
        if (tc.preconditions === `${tc.target_url}にアクセス可能` && 
            (!tc.test_steps || tc.test_steps.length <= 1)) {
          // 期待結果も汎用的な場合のみ削除
          if (tc.expected_result && genericExpectedResults.includes(tc.expected_result)) {
            console.log(chalk.gray(`  🗑️  最小限テスト削除: ${tc.test_case_name}`));
            return false;
          }
        }
      }
      
      return true;
    });
  }

  /**
   * 優先度を再評価
   */
  async reevaluatePriorities(testCases) {
    const priorityRules = {
      // セキュリティテストは最高優先度
      'セキュリティ': 'critical',
      // 認証・ログイン関連は高優先度
      'ログイン': 'high',
      '認証': 'high',
      // フォーム送信は高優先度
      'フォーム': 'high',
      // 基本機能は中優先度
      'ボタン': 'medium',
      'リンク': 'medium',
      // その他は低優先度
      'その他': 'low'
    };
    
    return testCases.map(tc => {
      // カテゴリに基づいて優先度を設定
      for (const [keyword, priority] of Object.entries(priorityRules)) {
        if (tc.test_category?.includes(keyword) || tc.test_case_name?.includes(keyword)) {
          tc.priority = priority;
          break;
        }
      }
      
      return tc;
    });
  }

  /**
   * カテゴリを整理
   */
  reorganizeCategories(testCases) {
    const categoryMap = {
      'インタラクティブ': '基本機能',
      'interactive': '基本機能',
      'link': 'リンク',
      'button': 'ボタン',
      'form': 'フォーム',
      'security': 'セキュリティ'
    };
    
    return testCases.map(tc => {
      const lowerCategory = tc.test_category?.toLowerCase() || '';
      
      for (const [key, newCategory] of Object.entries(categoryMap)) {
        if (lowerCategory.includes(key)) {
          tc.test_category = newCategory;
          break;
        }
      }
      
      return tc;
    });
  }

  /**
   * テストデータを改善（より適切なデータに変更）
   */
  async improveTestData(testCases) {
    console.log(chalk.blue('📝 テストデータを改善中...'));
    
    return testCases.map(tc => {
      // テストケース名とテストステップからコンテキストを理解
      const name = tc.test_case_name || '';
      const lowerName = name.toLowerCase();
      
      // 検索キーワードの改善
      if (lowerName.includes('検索') || lowerName.includes('search') || name.includes('キーワード')) {
        // 山田太郎のような人名を、より適切な検索キーワードに変更
        let improvedValue = null;
        
        if (tc.test_steps && tc.test_steps.length > 0) {
          tc.test_steps = tc.test_steps.map(step => {
            // fillアクションで山田太郎やテストデータが含まれている場合
            if (step.action === 'fill' && (step.value === '山田太郎' || step.value === 'テストデータ' || step.description?.includes('山田太郎'))) {
              // ECサイトなら商品名、一般サイトなら関連キーワードに変更
              const isEcommerce = tc.target_url?.includes('ec-cube') || 
                                 tc.target_url?.includes('shop') || 
                                 tc.target_url?.includes('store');
              
              if (isEcommerce) {
                // ECサイト用の商品検索キーワード（EC-CUBEデモサイトの実際の商品）
                const productKeywords = ['ジェラート', 'アイスサンド', 'CUBE', 'チェリー', 'フルーツ'];
                improvedValue = productKeywords[Math.floor(Math.random() * productKeywords.length)];
                step.value = improvedValue;
                step.description = step.description?.replace('山田太郎', improvedValue) || `検索キーワード「${improvedValue}」を入力`;
              } else {
                // 一般サイト用の検索キーワード
                improvedValue = 'サービス';
                step.value = improvedValue;
                step.description = step.description?.replace('山田太郎', improvedValue) || `検索キーワード「${improvedValue}」を入力`;
              }
            }
            return step;
          });
        }
        
        // テストケース名も更新
        if (name.includes('山田太郎') && improvedValue) {
          tc.test_case_name = name.replace('山田太郎', improvedValue);
        }
        
        // 期待結果も更新
        if (tc.expected_result?.includes('山田太郎') && improvedValue) {
          tc.expected_result = tc.expected_result.replace('山田太郎', improvedValue);
        }
      }
      
      // ログインフォームのテストデータ改善
      if (lowerName.includes('ログイン') || lowerName.includes('login')) {
        if (tc.test_steps && tc.test_steps.length > 0) {
          tc.test_steps = tc.test_steps.map(step => {
            if (step.action === 'fill') {
              // ユーザー名フィールド
              if (step.selector?.includes('user') || step.selector?.includes('email')) {
                step.value = 'test@example.com';
                step.description = 'メールアドレスを入力';
              }
              // パスワードフィールド
              else if (step.selector?.includes('pass')) {
                step.value = 'Test1234!';
                step.description = 'パスワードを入力';
              }
            }
            return step;
          });
        }
      }
      
      // 会員登録フォームのテストデータ改善
      if (lowerName.includes('登録') || lowerName.includes('signup') || lowerName.includes('register')) {
        if (tc.test_steps && tc.test_steps.length > 0) {
          tc.test_steps = tc.test_steps.map(step => {
            if (step.action === 'fill') {
              // 名前フィールド
              if (step.selector?.includes('name')) {
                if (step.selector?.includes('last')) {
                  step.value = '田中';
                  step.description = '姓を入力';
                } else if (step.selector?.includes('first')) {
                  step.value = '太郎';
                  step.description = '名を入力';
                } else {
                  step.value = '田中太郎';
                  step.description = '氏名を入力';
                }
              }
              // メールフィールド
              else if (step.selector?.includes('mail')) {
                step.value = `test${Date.now()}@example.com`;
                step.description = 'メールアドレスを入力';
              }
              // 電話番号フィールド
              else if (step.selector?.includes('tel') || step.selector?.includes('phone')) {
                step.value = '090-1234-5678';
                step.description = '電話番号を入力';
              }
              // 住所フィールド
              else if (step.selector?.includes('address')) {
                step.value = '東京都千代田区1-1-1';
                step.description = '住所を入力';
              }
            }
            return step;
          });
        }
      }
      
      // お問い合わせフォームのテストデータ改善
      if (lowerName.includes('問い合わせ') || lowerName.includes('contact')) {
        if (tc.test_steps && tc.test_steps.length > 0) {
          tc.test_steps = tc.test_steps.map(step => {
            if (step.action === 'fill') {
              // 件名フィールド
              if (step.selector?.includes('subject') || step.selector?.includes('title')) {
                step.value = '商品についての質問';
                step.description = '件名を入力';
              }
              // メッセージフィールド
              else if (step.selector?.includes('message') || step.selector?.includes('content')) {
                step.value = 'この商品の在庫状況を教えてください。';
                step.description = 'お問い合わせ内容を入力';
              }
            }
            return step;
          });
        }
      }
      
      return tc;
    });
  }

  /**
   * カテゴリ別に最適化
   */
  async optimizeByCategory(testCases, categorized) {
    const { selectedCategories } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedCategories',
        message: '最適化するカテゴリを選択:',
        choices: Object.keys(categorized).map(cat => ({
          name: `${cat} (${categorized[cat].length}件)`,
          value: cat
        }))
      }
    ]);
    
    const spinner = ora('選択されたカテゴリを最適化中...').start();
    
    const optimized = [];
    
    for (const category of Object.keys(categorized)) {
      if (selectedCategories.includes(category)) {
        // カテゴリ内で最適化
        const categoryTests = categorized[category];
        const optimizedCategory = await this.optimizeCategoryTests(categoryTests, category);
        optimized.push(...optimizedCategory);
      } else {
        // 選択されていないカテゴリはそのまま
        optimized.push(...categorized[category]);
      }
    }
    
    spinner.succeed('カテゴリ別最適化完了');
    
    return {
      ...testCases,
      test_cases: optimized,
      optimized_at: new Date().toISOString(),
      optimization_mode: 'category'
    };
  }

  /**
   * カテゴリ内のテストを最適化
   */
  async optimizeCategoryTests(tests, category) {
    // カテゴリ別の最適化ルール
    switch (category) {
      case 'セキュリティ':
        // セキュリティテストは全て保持
        return tests;
        
      case 'フォーム':
        // 重複するフォームテストを統合
        return this.consolidateFormTests(tests);
        
      case 'リンク':
        // 重要なリンクのみ保持
        return this.filterImportantLinks(tests);
        
      case 'ボタン':
        // アクション可能なボタンのみ保持
        return this.filterActionableButtons(tests);
        
      default:
        // デフォルトは重複削除のみ
        return this.removeDuplicates(tests);
    }
  }

  /**
   * フォームテストを統合
   */
  consolidateFormTests(tests) {
    const formGroups = new Map();
    
    tests.forEach(test => {
      const formId = test.form_id || test.selector || 'default';
      if (!formGroups.has(formId)) {
        formGroups.set(formId, []);
      }
      formGroups.get(formId).push(test);
    });
    
    const consolidated = [];
    
    formGroups.forEach((group, formId) => {
      if (group.length > 1) {
        // 複数のテストを1つに統合
        const merged = {
          ...group[0],
          test_case_name: `統合フォームテスト_${formId}`,
          test_steps: group.flatMap(t => t.test_steps || [])
        };
        consolidated.push(merged);
      } else {
        consolidated.push(...group);
      }
    });
    
    return consolidated;
  }

  /**
   * 重要なリンクのみフィルタ
   */
  filterImportantLinks(tests) {
    const importantKeywords = [
      'ログイン', 'ログアウト', '新規登録', '会員登録',
      'カート', '購入', '注文', 'マイページ',
      'ホーム', 'トップ', 'お問い合わせ', 'ヘルプ'
    ];
    
    return tests.filter(test => {
      const name = test.test_case_name?.toLowerCase() || '';
      return importantKeywords.some(keyword => name.includes(keyword.toLowerCase()));
    });
  }

  /**
   * アクション可能なボタンのみフィルタ
   */
  filterActionableButtons(tests) {
    return tests.filter(test => {
      // 送信、保存、登録などのアクションボタンを優先
      const actionKeywords = ['送信', '保存', '登録', '更新', '削除', '追加', 'ログイン', '検索'];
      const name = test.test_case_name || '';
      return actionKeywords.some(keyword => name.includes(keyword));
    });
  }

  /**
   * セキュリティテストの最適化
   */
  async optimizeSecurityTests(testCases) {
    const spinner = ora('セキュリティテストを最適化中...').start();
    
    const securityTests = testCases.test_cases.filter(tc => 
      tc.test_category === 'セキュリティ' || tc.test_type === 'security'
    );
    
    const otherTests = testCases.test_cases.filter(tc => 
      tc.test_category !== 'セキュリティ' && tc.test_type !== 'security'
    );
    
    // セキュリティテストの重複を削除（同じペイロードとセレクタ）
    const uniqueSecurityTests = [];
    const seenPayloads = new Set();
    
    securityTests.forEach(test => {
      const payload = test.test_data?.payload || test.value || '';
      const key = `${test.selector}_${payload}`;
      
      if (!seenPayloads.has(key)) {
        seenPayloads.add(key);
        uniqueSecurityTests.push(test);
      }
    });
    
    spinner.succeed(`セキュリティテスト最適化完了: ${securityTests.length} → ${uniqueSecurityTests.length}件`);
    
    return {
      ...testCases,
      test_cases: [...otherTests, ...uniqueSecurityTests],
      optimized_at: new Date().toISOString(),
      optimization_mode: 'security'
    };
  }

  /**
   * クリーンアップ（重複・無効削除）
   */
  async cleanupTests(testCases) {
    const spinner = ora('テストケースをクリーンアップ中...').start();
    
    let cleaned = this.removeDuplicates(testCases.test_cases);
    cleaned = this.removeInvalidTests(cleaned);
    
    // テストデータを改善
    spinner.text = 'テストデータを改善中...';
    cleaned = await this.improveTestData(cleaned);
    
    // 重要なフィールドが欠落している場合はデフォルト値を設定
    cleaned = cleaned.map(tc => ({
      ...tc,
      prerequisite: tc.prerequisite || 'ブラウザが起動している状態',
      test_steps: tc.test_steps && tc.test_steps.length > 0 ? tc.test_steps : [
        {
          step_number: 1,
          action: tc.action || 'navigate',
          target: tc.target_url || this.config.target_url,
          value: tc.value || '',
          description: tc.description || `${tc.test_case_name}を実行`
        }
      ],
      expected_result: tc.expected_result || `${tc.test_case_name}が正常に動作すること`
    }));
    
    spinner.succeed(`クリーンアップ完了: ${testCases.test_cases.length} → ${cleaned.length}件`);
    
    return {
      ...testCases,
      test_cases: cleaned,
      optimized_at: this.getJSTTimestamp(),
      optimization_mode: 'cleanup'
    };
  }

  /**
   * 完全レビュー（AI CLIを使用）
   */
  async fullReview(testCases) {
    console.log(chalk.yellow('\n⚠️  完全レビューは時間がかかる場合があります\n'));
    
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: '続行しますか？',
        default: false
      }
    ]);
    
    if (!confirmed) {
      return testCases;
    }
    
    const spinner = ora('AI CLIで完全レビュー中...').start();
    
    try {
      const cli = this.config.ai_cli_settings.default_cli || 'gemini';
      
      // テストケースをバッチに分割（大量のテストケースに対応）
      const batchSize = 20;
      const batches = [];
      for (let i = 0; i < testCases.test_cases.length; i += batchSize) {
        batches.push(testCases.test_cases.slice(i, i + batchSize));
      }
      
      const reviewedBatches = [];
      
      for (let i = 0; i < batches.length; i++) {
        spinner.text = `AI CLIでレビュー中... (${i + 1}/${batches.length})`;
        
        const prompt = this.buildReviewPrompt(batches[i]);
        const response = await this.cliManager.execute(cli, prompt, {
          temperature: 0.7,
          maxTokens: 3000
        });
        
        const reviewed = this.parseReviewResponse(response, batches[i]);
        reviewedBatches.push(...reviewed);
      }
      
      spinner.succeed('完全レビュー完了');
      
      return {
        ...testCases,
        test_cases: reviewedBatches,
        optimized_at: new Date().toISOString(),
        optimization_mode: 'full_review',
        reviewed_by: cli
      };
      
    } catch (error) {
      spinner.fail('レビューエラー');
      console.error(chalk.red('エラー:'), error.message);
      return testCases;
    }
  }

  /**
   * レビュー用プロンプトを構築
   */
  buildReviewPrompt(testCases) {
    return `以下のテストケースをレビューして最適化してください。

【レビュー観点】
1. 重複の削除
2. 優先度の適正化
3. テストケース名の改善
4. 無効なテストの削除
5. カテゴリの整理

【テストケース】
${JSON.stringify(testCases, null, 2)}

【出力形式】
各テストケースについて、以下の形式でJSONを返してください：
{
  "optimized": true/false,
  "test_id": "元のID",
  "test_case_name": "改善された名前",
  "priority": "critical/high/medium/low",
  "should_delete": true/false,
  "reason": "変更理由"
}`;
  }

  /**
   * AIレビュー結果をパース
   */
  parseReviewResponse(response, originalTests) {
    try {
      // AI応答からJSON部分を抽出
      const jsonMatch = response.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log(chalk.yellow('⚠️  AIレビュー結果のパースに失敗。元のテストケースを使用'));
        return originalTests;
      }
      
      const reviews = JSON.parse(jsonMatch[0]);
      const optimized = [];
      
      originalTests.forEach((test, index) => {
        const review = Array.isArray(reviews) ? reviews[index] : reviews;
        
        if (review && !review.should_delete) {
          optimized.push({
            ...test,
            test_case_name: review.test_case_name || test.test_case_name,
            priority: review.priority || test.priority,
            optimized: true
          });
        }
      });
      
      return optimized;
      
    } catch (error) {
      console.log(chalk.yellow('⚠️  レビュー結果のパースエラー。元のテストケースを使用'));
      return originalTests;
    }
  }

  /**
   * テストケースをカテゴリ別に分類
   */
  categorizeTestCases(testCases) {
    const categorized = {};
    
    testCases.forEach(tc => {
      const category = tc.test_category || 'その他';
      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push(tc);
    });
    
    return categorized;
  }

  /**
   * カテゴリサマリーを表示
   */
  showCategorySummary(categorized) {
    console.log(chalk.cyan('📊 カテゴリ別サマリー:'));
    console.log(chalk.gray('─'.repeat(40)));
    
    Object.entries(categorized).forEach(([category, tests]) => {
      const priorities = {
        critical: tests.filter(t => t.priority === 'critical').length,
        high: tests.filter(t => t.priority === 'high').length,
        medium: tests.filter(t => t.priority === 'medium').length,
        low: tests.filter(t => t.priority === 'low').length
      };
      
      console.log(`${category}: ${tests.length}件`);
      console.log(chalk.gray(`  優先度: Critical=${priorities.critical}, High=${priorities.high}, Medium=${priorities.medium}, Low=${priorities.low}`));
    });
    
    console.log(chalk.gray('─'.repeat(40)) + '\n');
  }

  /**
   * 最適化結果を表示
   */
  showOptimizationResults(original, optimized) {
    const originalCount = original.test_cases.length;
    const optimizedCount = optimized.test_cases.length;
    const reduction = originalCount - optimizedCount;
    const reductionRate = originalCount > 0 ? Math.round((reduction / originalCount) * 100) : 0;
    
    console.log(chalk.cyan('\n📈 最適化結果:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`元のテストケース数: ${originalCount}`);
    console.log(`最適化後: ${optimizedCount}`);
    console.log(`削減数: ${reduction} (${reductionRate}%)`);
    
    // カテゴリ別の変化
    const originalCategorized = this.categorizeTestCases(original.test_cases);
    const optimizedCategorized = this.categorizeTestCases(optimized.test_cases);
    
    console.log(chalk.cyan('\nカテゴリ別変化:'));
    const allCategories = new Set([
      ...Object.keys(originalCategorized),
      ...Object.keys(optimizedCategorized)
    ]);
    
    allCategories.forEach(category => {
      const before = originalCategorized[category]?.length || 0;
      const after = optimizedCategorized[category]?.length || 0;
      const diff = after - before;
      const diffStr = diff > 0 ? `+${diff}` : diff.toString();
      const diffColor = diff > 0 ? chalk.green : diff < 0 ? chalk.red : chalk.gray;
      
      console.log(`  ${category}: ${before} → ${after} (${diffColor(diffStr)})`);
    });
    
    console.log(chalk.gray('─'.repeat(40)));
  }
}

export default TestCaseOptimizer;