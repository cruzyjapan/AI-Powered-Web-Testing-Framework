import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { createObjectCsvWriter } from 'csv-writer';
import chalk from 'chalk';

class TestSheetGenerator {
  constructor(config) {
    this.config = config;
    this.testCases = this.loadTestCases();
  }

  loadTestCases() {
    const testCasesPath = path.join(process.cwd(), 'config', 'test-cases.json');
    try {
      if (fs.existsSync(testCasesPath)) {
        return JSON.parse(fs.readFileSync(testCasesPath, 'utf8'));
      }
    } catch (error) {
      console.error(chalk.red('テストケース読み込みエラー:'), error.message);
    }
    return { test_cases: [] };
  }

  async generateTestSheet(results, reportDir) {
    console.log(chalk.blue('📊 テストシート生成中...'));

    if (this.config.output_settings.formats.includes('csv')) {
      await this.generateCSV(results, reportDir);
    }

    if (this.config.output_settings.formats.includes('excel')) {
      await this.generateExcel(results, reportDir);
    }
  }

  async generateCSV(results, reportDir) {
    const csvPath = path.join(reportDir, 'test-results.csv');
    
    // CSVヘッダー定義
    const csvWriter = createObjectCsvWriter({
      path: csvPath,
      header: [
        { id: 'test_id', title: 'テスト項目ID' },
        { id: 'test_category', title: 'テストカテゴリ' },
        { id: 'test_case_name', title: 'テスト項目名' },
        { id: 'priority', title: '優先度' },
        { id: 'preconditions', title: '前提条件' },
        { id: 'test_steps', title: 'テスト手順' },
        { id: 'expected_result', title: '期待結果' },
        { id: 'actual_result', title: '実行結果' },
        { id: 'judgment', title: '判定' },
        { id: 'tester', title: '実行者' },
        { id: 'execution_date', title: '実行日時' },
        { id: 'execution_time', title: '実行時間(秒)' },
        { id: 'error_content', title: 'エラー内容' },
        { id: 'screenshot', title: 'スクリーンショット' },
        { id: 'used_cli', title: '使用CLI' },
        { id: 'remarks', title: '備考' }
      ],
      encoding: 'utf8',
      append: false
    });

    // BOM付きUTF-8で出力（Excelで文字化けを防ぐ）
    const BOM = '\uFEFF';
    
    // テスト結果をCSV形式に変換
    const csvData = results.map(result => {
      const testCase = this.testCases.test_cases.find(tc => tc.test_id === result.test_id);
      
      return {
        test_id: result.test_id,
        test_category: testCase?.test_category || result.test_category || '未分類',
        test_case_name: testCase?.test_case_name || result.test_name,
        priority: testCase?.priority || result.priority || 'Medium',
        preconditions: testCase?.preconditions || '',
        test_steps: this.formatTestSteps(testCase?.test_steps),
        expected_result: testCase?.expected_result || '',
        actual_result: result.actual_result || '',
        judgment: this.mapJudgment(result.status),
        tester: this.config.test_sheet_format.tester_name,
        execution_date: this.formatDate(result.execution_date),
        execution_time: result.execution_time,
        error_content: result.error || '',
        screenshot: result.screenshot || '',
        used_cli: result.cli,
        remarks: result.remarks || ''
      };
    });

    await csvWriter.writeRecords(csvData);
    
    // BOMを追加
    const content = fs.readFileSync(csvPath, 'utf8');
    fs.writeFileSync(csvPath, BOM + content, 'utf8');
    
    console.log(chalk.green(`✅ CSV生成完了: test-results.csv`));
  }

  async generateExcel(results, reportDir) {
    const excelPath = path.join(reportDir, 'test-results.xlsx');
    
    // ワークブック作成
    const workbook = XLSX.utils.book_new();

    // シート1: テスト結果一覧
    const resultsData = this.prepareResultsData(results);
    const resultsSheet = XLSX.utils.json_to_sheet(resultsData);
    
    // 列幅設定
    resultsSheet['!cols'] = [
      { wch: 10 },  // テスト項目ID
      { wch: 15 },  // テストカテゴリ
      { wch: 25 },  // テスト項目名
      { wch: 8 },   // 優先度
      { wch: 20 },  // 前提条件
      { wch: 30 },  // テスト手順
      { wch: 20 },  // 期待結果
      { wch: 20 },  // 実行結果
      { wch: 8 },   // 判定
      { wch: 12 },  // 実行者
      { wch: 20 },  // 実行日時
      { wch: 12 },  // 実行時間
      { wch: 30 },  // エラー内容
      { wch: 20 },  // スクリーンショット
      { wch: 10 },  // 使用CLI
      { wch: 20 }   // 備考
    ];

    // スタイル設定
    this.applyExcelStyles(resultsSheet, resultsData);

    XLSX.utils.book_append_sheet(workbook, resultsSheet, 'テスト結果一覧');

    // シート2: テストサマリー
    const summaryData = this.prepareSummaryData(results);
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    
    // サマリーシートの列幅設定
    summarySheet['!cols'] = [
      { wch: 30 },  // 項目
      { wch: 20 }   // 値
    ];
    
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'テストサマリー');

    // シート3: エラー詳細
    const errorData = this.prepareErrorData(results);
    if (errorData.length > 0) {
      const errorSheet = XLSX.utils.json_to_sheet(errorData);
      
      // エラーシートの列幅設定
      errorSheet['!cols'] = [
        { wch: 10 },  // テスト項目ID
        { wch: 25 },  // テスト項目名
        { wch: 10 },  // エラー種別
        { wch: 40 },  // エラー内容
        { wch: 20 },  // スクリーンショット
        { wch: 20 },  // 実行日時
        { wch: 10 },  // 使用CLI
        { wch: 30 }   // 対処法
      ];
      
      XLSX.utils.book_append_sheet(workbook, errorSheet, 'エラー詳細');
    }

    // シート4: カテゴリ別統計
    const categoryStats = this.prepareCategoryStats(results);
    const categorySheet = XLSX.utils.json_to_sheet(categoryStats);
    
    categorySheet['!cols'] = [
      { wch: 20 },  // カテゴリ
      { wch: 10 },  // 総数
      { wch: 10 },  // 成功
      { wch: 10 },  // 失敗
      { wch: 10 },  // エラー
      { wch: 15 }   // 成功率
    ];
    
    XLSX.utils.book_append_sheet(workbook, categorySheet, 'カテゴリ別統計');

    // ファイル書き出し
    XLSX.writeFile(workbook, excelPath);
    console.log(chalk.green(`✅ Excel生成完了: test-results.xlsx`));
  }

  prepareResultsData(results) {
    return results.map(result => {
      const testCase = this.testCases.test_cases.find(tc => tc.test_id === result.test_id);
      
      return {
        'テスト項目ID': result.test_id,
        'テストカテゴリ': testCase?.test_category || result.test_category || '未分類',
        'テスト項目名': testCase?.test_case_name || result.test_name,
        '優先度': testCase?.priority || result.priority || 'Medium',
        '前提条件': testCase?.preconditions || '',
        'テスト手順': this.formatTestSteps(testCase?.test_steps),
        '期待結果': testCase?.expected_result || '',
        '実行結果': result.actual_result || '',
        '判定': this.mapJudgment(result.status),
        '実行者': this.config.test_sheet_format.tester_name,
        '実行日時': this.formatDate(result.execution_date),
        '実行時間(秒)': result.execution_time,
        'エラー内容': result.error || '',
        'スクリーンショット': result.screenshot || '',
        '使用CLI': result.cli,
        '備考': result.remarks || ''
      };
    });
  }

  prepareSummaryData(results) {
    const total = results.length;
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const errors = results.filter(r => r.status === 'ERROR').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    
    const totalTime = results.reduce((sum, r) => sum + (r.execution_time || 0), 0);
    const avgTime = total > 0 ? Math.round(totalTime / total) : 0;

    const categorySummary = this.getCategorySummary(results);
    const prioritySummary = this.getPrioritySummary(results);

    const summaryData = [
      {
        '項目': 'プロジェクト名',
        '値': this.config.test_sheet_format.project_name
      },
      {
        '項目': 'バージョン',
        '値': this.config.test_sheet_format.version
      },
      {
        '項目': 'テストフェーズ',
        '値': this.config.test_sheet_format.test_phase
      },
      {
        '項目': '実行者',
        '値': this.config.test_sheet_format.tester_name
      },
      {
        '項目': '実行日時',
        '値': new Date().toLocaleString('ja-JP')
      },
      {
        '項目': '',
        '値': ''
      },
      {
        '項目': '【実行結果】',
        '値': ''
      },
      {
        '項目': '総テスト数',
        '値': total
      },
      {
        '項目': '成功',
        '値': passed
      },
      {
        '項目': '失敗',
        '値': failed
      },
      {
        '項目': 'エラー',
        '値': errors
      },
      {
        '項目': 'スキップ',
        '値': skipped
      },
      {
        '項目': '成功率',
        '値': `${passRate}%`
      },
      {
        '項目': '',
        '値': ''
      },
      {
        '項目': '【実行時間】',
        '値': ''
      },
      {
        '項目': '総実行時間(秒)',
        '値': totalTime
      },
      {
        '項目': '平均実行時間(秒)',
        '値': avgTime
      },
      {
        '項目': '',
        '値': ''
      },
      {
        '項目': '【優先度別】',
        '値': ''
      }
    ];

    // 優先度別サマリー追加
    Object.entries(prioritySummary).forEach(([priority, stats]) => {
      summaryData.push({
        '項目': `${priority}優先度`,
        '値': `${stats.passed}/${stats.total} (成功率: ${Math.round((stats.passed / stats.total) * 100)}%)`
      });
    });

    summaryData.push({
      '項目': '',
      '値': ''
    });
    summaryData.push({
      '項目': '【カテゴリ別】',
      '値': ''
    });

    // カテゴリ別サマリー追加
    Object.entries(categorySummary).forEach(([category, stats]) => {
      summaryData.push({
        '項目': category,
        '値': `${stats.passed}/${stats.total} (成功率: ${Math.round((stats.passed / stats.total) * 100)}%)`
      });
    });

    return summaryData;
  }

  prepareErrorData(results) {
    return results
      .filter(result => result.status === 'FAIL' || result.status === 'ERROR')
      .map(result => {
        const testCase = this.testCases.test_cases.find(tc => tc.test_id === result.test_id);
        
        return {
          'テスト項目ID': result.test_id,
          'テスト項目名': testCase?.test_case_name || result.test_name,
          'エラー種別': result.status,
          'エラー内容': result.error || result.actual_result || '',
          'スクリーンショット': result.screenshot || '',
          '実行日時': this.formatDate(result.execution_date),
          '使用CLI': result.cli,
          '対処法': this.suggestFix(result.error)
        };
      });
  }

  prepareCategoryStats(results) {
    const stats = this.getCategorySummary(results);
    
    return Object.entries(stats).map(([category, data]) => ({
      'カテゴリ': category,
      '総数': data.total,
      '成功': data.passed,
      '失敗': data.failed,
      'エラー': data.errors,
      '成功率': `${Math.round((data.passed / data.total) * 100)}%`
    }));
  }

  getCategorySummary(results) {
    const summary = {};
    
    results.forEach(result => {
      const testCase = this.testCases.test_cases.find(tc => tc.test_id === result.test_id);
      const category = testCase?.test_category || result.test_category || '未分類';
      
      if (!summary[category]) {
        summary[category] = { total: 0, passed: 0, failed: 0, errors: 0 };
      }
      
      summary[category].total++;
      
      switch (result.status) {
        case 'PASS':
          summary[category].passed++;
          break;
        case 'FAIL':
          summary[category].failed++;
          break;
        case 'ERROR':
          summary[category].errors++;
          break;
      }
    });
    
    return summary;
  }

  getPrioritySummary(results) {
    const summary = {};
    
    results.forEach(result => {
      const testCase = this.testCases.test_cases.find(tc => tc.test_id === result.test_id);
      const priority = testCase?.priority || result.priority || 'Medium';
      
      if (!summary[priority]) {
        summary[priority] = { total: 0, passed: 0 };
      }
      
      summary[priority].total++;
      
      if (result.status === 'PASS') {
        summary[priority].passed++;
      }
    });
    
    return summary;
  }

  formatTestSteps(steps) {
    if (!steps || steps.length === 0) return '';
    
    return steps.map(step => `${step.step_number}. ${step.description}`).join(' → ');
  }

  formatDate(dateString) {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateString;
    }
  }

  mapJudgment(status) {
    switch (status) {
      case 'PASS':
        return 'Pass';
      case 'FAIL':
        return 'Fail';
      case 'ERROR':
        return 'Error';
      case 'SKIP':
        return 'Skip';
      case 'PENDING':
        return 'Pending';
      default:
        return status || 'Unknown';
    }
  }

  suggestFix(error) {
    if (!error) return '';
    
    const errorLower = error.toLowerCase();
    
    if (errorLower.includes('timeout')) {
      return 'タイムアウト値の見直し、サーバー負荷確認';
    } else if (errorLower.includes('not found') || errorLower.includes('404')) {
      return 'URLパスの確認、要素セレクタの見直し';
    } else if (errorLower.includes('login') || errorLower.includes('auth')) {
      return 'ログイン情報の確認、認証設定の見直し';
    } else if (errorLower.includes('network') || errorLower.includes('connection')) {
      return 'ネットワーク接続の確認、VPN設定確認';
    } else if (errorLower.includes('element') || errorLower.includes('selector')) {
      return 'セレクタの確認、要素の存在確認、待機時間の追加';
    } else if (errorLower.includes('click')) {
      return '要素の可視性確認、クリック可能状態の確認';
    } else if (errorLower.includes('permission') || errorLower.includes('access')) {
      return 'アクセス権限の確認、認証情報の見直し';
    } else {
      return 'ログの詳細確認が必要';
    }
  }

  applyExcelStyles(sheet, data) {
    if (!sheet || !data || data.length === 0) return;
    
    // ヘッダー行のスタイル設定
    const headerRow = 1;
    const columnCount = Object.keys(data[0]).length;
    
    for (let col = 0; col < columnCount; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (sheet[cellAddress]) {
        sheet[cellAddress].s = {
          fill: { fgColor: { rgb: 'F8F9FA' } },
          font: { bold: true },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
    }
    
    // 判定列の条件付き書式設定
    const judgmentColIndex = Object.keys(data[0]).findIndex(key => key === '判定');
    if (judgmentColIndex >= 0) {
      for (let row = 1; row <= data.length; row++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: judgmentColIndex });
        if (sheet[cellAddress]) {
          const value = sheet[cellAddress].v;
          if (value === 'Pass') {
            sheet[cellAddress].s = {
              fill: { fgColor: { rgb: 'D4EDDA' } },
              font: { color: { rgb: '155724' }, bold: true }
            };
          } else if (value === 'Fail' || value === 'Error') {
            sheet[cellAddress].s = {
              fill: { fgColor: { rgb: 'F8D7DA' } },
              font: { color: { rgb: '721C24' }, bold: true }
            };
          }
        }
      }
    }
    
    // 行の境界線設定
    const range = XLSX.utils.decode_range(sheet['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!sheet[cellAddress]) continue;
        if (!sheet[cellAddress].s) sheet[cellAddress].s = {};
        sheet[cellAddress].s.border = {
          top: { style: 'thin', color: { rgb: 'DDDDDD' } },
          bottom: { style: 'thin', color: { rgb: 'DDDDDD' } },
          left: { style: 'thin', color: { rgb: 'DDDDDD' } },
          right: { style: 'thin', color: { rgb: 'DDDDDD' } }
        };
      }
    }
  }
}

export default TestSheetGenerator;