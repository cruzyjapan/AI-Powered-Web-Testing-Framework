import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

class CLIManager {
  constructor(config) {
    this.config = config;
    this.availableCLIs = this.detectAvailableCLIs();
    this.maxExecutionTime = 3600000; // 最大1時間 (60分)
    this.initialTimeout = 300000; // 初期タイムアウト 5分
    this.timeoutExtension = 300000; // 延長単位 5分
    this.progressInterval = 30000; // 進捗報告間隔 30秒
  }

  detectAvailableCLIs() {
    const clis = [];
    
    // Gemini CLI検出
    try {
      const result = execAsync('which gemini').catch(() => null);
      if (result) {
        clis.push('gemini');
        console.log(chalk.green('✅ Gemini CLI 検出'));
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️  Gemini CLI 未検出'));
    }

    // Claude Code CLI検出
    try {
      const result = execAsync('which claude').catch(() => null);
      if (result) {
        clis.push('claude');
        console.log(chalk.green('✅ Claude Code CLI 検出'));
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️  Claude Code CLI 未検出'));
    }

    return clis;
  }

  async execute(cli, prompt, options = {}) {
    const spinner = ora(`${cli} CLIでテスト実行中...`).start();
    
    try {
      // CLIが利用可能か確認
      if (!this.isAvailable(cli)) {
        throw new Error(`${cli} CLIは利用できません`);
      }

      let command;
      let response;

      switch (cli) {
        case 'gemini':
          response = await this.executeGemini(prompt, options);
          break;
        
        case 'claude':
          response = await this.executeClaude(prompt, options);
          break;
        
        case 'auto':
          response = await this.executeAuto(prompt, options);
          break;
        
        default:
          throw new Error(`未対応のCLI: ${cli}`);
      }

      spinner.succeed(`${cli} CLI実行完了`);
      return response;

    } catch (error) {
      spinner.fail(`${cli} CLI実行失敗`);
      throw error;
    }
  }

  async executeGemini(prompt, options) {
    const model = this.config.ai_cli_settings.gemini.model || 'gemini-2.5-pro';
    
    // 自動タイムアウト延長機能付き実行
    return await this.executeWithAutoTimeout('gemini', prompt, model, options);
  }

  async executeClaude(prompt, options) {
    const model = this.config.ai_cli_settings.claude.model || 'claude-sonnet-4';
    
    // 自動タイムアウト延長機能付き実行
    return await this.executeWithAutoTimeout('claude', prompt, model, options);
  }

  async executeWithAutoTimeout(cli, prompt, model, options) {
    const startTime = Date.now();
    let totalExecutionTime = 0;
    let currentTimeout = this.initialTimeout;
    let attemptCount = 0;
    let lastResponse = null;
    let accumulatedResponse = '';
    
    // 設定から最大時間を取得
    const maxTime = this.config.ai_cli_settings[cli]?.max_timeout 
      ? this.config.ai_cli_settings[cli].max_timeout * 1000 
      : this.maxExecutionTime;
    
    const autoExtend = this.config.ai_cli_settings[cli]?.auto_extend !== false;
    
    console.log(chalk.blue('━'.repeat(60)));
    console.log(chalk.bold.blue(`🤖 ${cli.toUpperCase()} CLI 実行開始`));
    console.log(chalk.blue('━'.repeat(60)));
    console.log(chalk.cyan(`📋 モデル: ${model}`));
    console.log(chalk.cyan(`⏱️  最大実行時間: ${maxTime / 60000}分`));
    console.log(chalk.cyan(`🔄 自動延長: ${autoExtend ? '有効' : '無効'}`));
    console.log(chalk.blue('─'.repeat(60)));
    
    while (totalExecutionTime < maxTime) {
      attemptCount++;
      const elapsedMinutes = Math.round(totalExecutionTime / 60000);
      const remainingTime = maxTime - totalExecutionTime;
      currentTimeout = Math.min(currentTimeout, remainingTime);
      
      console.log(chalk.yellow(`\n⚡ 実行試行 #${attemptCount}`));
      console.log(chalk.gray(`  経過時間: ${elapsedMinutes}分 / 残り時間: ${Math.round(remainingTime / 60000)}分`));
      console.log(chalk.gray(`  現在のタイムアウト: ${Math.round(currentTimeout / 60000)}分`));
      
      try {
        // コマンド構築
        const command = cli === 'gemini' ? 
          this.buildGeminiCommand(prompt, model, options) :
          this.buildClaudeCommand(prompt, model, options);
        
        // タイムアウト付きで実行
        const result = await this.executeCommandWithTimeout(command, currentTimeout, cli, attemptCount);
        
        if (result.completed) {
          const finalTime = Math.round((Date.now() - startTime) / 60000);
          console.log(chalk.green('─'.repeat(60)));
          console.log(chalk.bold.green(`✅ ${cli.toUpperCase()} CLI実行完了`));
          console.log(chalk.green(`📊 総実行時間: ${finalTime}分`));
          console.log(chalk.green(`📝 応答文字数: ${result.stdout.length}文字`));
          console.log(chalk.green('━'.repeat(60)));
          
          return cli === 'gemini' ? 
            this.parseGeminiResponse(result.stdout) :
            this.parseClaudeResponse(result.stdout);
        }
        
        // 部分的な応答を蓄積
        if (result.stdout) {
          accumulatedResponse += result.stdout;
          lastResponse = result.stdout;
        }
        
      } catch (error) {
        if ((error.code === 'ETIMEDOUT' || error.message.includes('timeout')) && autoExtend) {
          totalExecutionTime = Date.now() - startTime;
          
          if (totalExecutionTime >= maxTime) {
            console.log(chalk.yellow('━'.repeat(60)));
            console.log(chalk.yellow(`⚠️  最大実行時間 (${maxTime / 60000}分) に到達`));
            console.log(chalk.yellow('━'.repeat(60)));
            break;
          }
          
          // タイムアウトを延長
          const extensionTime = Math.min(this.timeoutExtension, remainingTime);
          console.log(chalk.magenta('─'.repeat(60)));
          console.log(chalk.magenta(`⏳ タイムアウト検出 - 自動延長中...`));
          console.log(chalk.magenta(`  延長時間: ${extensionTime / 60000}分`));
          console.log(chalk.magenta(`  蓄積応答: ${accumulatedResponse.length}文字`));
          console.log(chalk.magenta('─'.repeat(60)));
          
          currentTimeout = extensionTime;
          
          // プロンプトに継続指示を追加（応答がある場合）
          if (lastResponse && lastResponse.length > 100) {
            const continuationContext = lastResponse.substring(Math.max(0, lastResponse.length - 1000));
            prompt = `[継続実行] 以下の処理を続けてください。前回の処理は以下で終了しています:\n\n...${continuationContext}\n\n元のリクエスト:\n${prompt}`;
          }
          
        } else {
          console.error(chalk.red('━'.repeat(60)));
          console.error(chalk.red(`❌ エラー発生: ${error.message}`));
          console.error(chalk.red('━'.repeat(60)));
          throw error;
        }
      }
    }
    
    // 最大時間に到達した場合の処理
    if (accumulatedResponse || lastResponse) {
      const response = accumulatedResponse || lastResponse;
      console.log(chalk.yellow('━'.repeat(60)));
      console.log(chalk.yellow('⚠️  部分的な応答を返します'));
      console.log(chalk.yellow(`📝 取得済み応答: ${response.length}文字`));
      console.log(chalk.yellow('━'.repeat(60)));
      
      return cli === 'gemini' ? 
        this.parseGeminiResponse(response) :
        this.parseClaudeResponse(response);
    }
    
    throw new Error(`${cli} CLI実行が最大時間 (${maxTime / 60000}分) を超過しました`);
  }

  async executeCommandWithTimeout(command, timeout, cli, attemptNumber = 1) {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let completed = false;
      let processKilled = false;
      let lastProgressReport = Date.now();
      
      // spawnを使用してプロセスを起動
      const child = spawn('bash', ['-c', command]);
      
      // 進捗報告タイマー
      const progressTimer = setInterval(() => {
        if (!completed && stdout.length > 0) {
          const elapsed = Math.round((Date.now() - lastProgressReport) / 1000);
          console.log(chalk.gray(`  📊 進捗: ${stdout.length}文字受信 (${elapsed}秒経過)`));
        }
      }, this.progressInterval);
      
      // タイムアウトタイマー
      const timer = setTimeout(() => {
        if (!completed) {
          processKilled = true;
          console.log(chalk.yellow(`  ⏰ タイムアウト (${timeout / 60000}分) - プロセス停止中...`));
          child.kill('SIGTERM');
          
          // 強制終了
          setTimeout(() => {
            if (!completed) {
              console.log(chalk.red(`  🔨 強制終了実行`));
              child.kill('SIGKILL');
            }
          }, 5000);
        }
      }, timeout);
      
      // 標準出力を収集
      child.stdout.on('data', (data) => {
        stdout += data.toString();
        
        // 進捗表示（大量の出力がある場合）
        if (stdout.length % 50000 === 0) {
          console.log(chalk.cyan(`  💾 ${cli}: ${Math.round(stdout.length / 1000)}KB受信...`));
        }
      });
      
      // 標準エラー出力を収集
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      // プロセス終了時
      child.on('close', (code) => {
        clearTimeout(timer);
        clearInterval(progressTimer);
        completed = true;
        
        if (processKilled) {
          console.log(chalk.yellow(`  ⚠️  タイムアウトによりプロセス停止 (取得済み: ${stdout.length}文字)`));
          resolve({
            stdout: stdout,
            stderr: stderr,
            completed: false,
            timedOut: true
          });
        } else if (code === 0) {
          console.log(chalk.green(`  ✅ プロセス正常終了 (応答: ${stdout.length}文字)`));
          resolve({
            stdout: stdout,
            stderr: stderr,
            completed: true,
            timedOut: false
          });
        } else {
          reject(new Error(`プロセスがエラーコード ${code} で終了しました: ${stderr}`));
        }
      });
      
      // エラーハンドリング
      child.on('error', (error) => {
        clearTimeout(timer);
        clearInterval(progressTimer);
        completed = true;
        reject(error);
      });
    });
  }

  async executeAuto(prompt, options) {
    // 自動選択モード：利用可能なCLIを自動選択
    const defaultCli = this.config.ai_cli_settings.default_cli;
    
    if (defaultCli !== 'auto' && this.isAvailable(defaultCli)) {
      return this.execute(defaultCli, prompt, options);
    }
    
    // 優先順位でCLIを選択
    const priorityOrder = ['gemini', 'claude'];
    
    for (const cli of priorityOrder) {
      if (this.isAvailable(cli) && this.config.ai_cli_settings[cli].enabled) {
        console.log(chalk.blue(`自動選択: ${cli} CLIを使用`));
        return this.execute(cli, prompt, options);
      }
    }
    
    throw new Error('利用可能なAI CLIがありません');
  }

  buildGeminiCommand(prompt, model, options) {
    // Gemini CLI用のコマンド構築
    // 長いプロンプトの場合、一時ファイルを使用
    
    // 一時ファイルパス生成
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `gemini_prompt_${Date.now()}.txt`);
    
    // プロンプトを一時ファイルに書き込み
    fs.writeFileSync(tmpFile, prompt);
    
    // ファイルからGemini CLIに入力
    let command = `cat "${tmpFile}" | gemini && rm -f "${tmpFile}"`;
    
    return command;
  }

  buildClaudeCommand(prompt, model, options) {
    // Claude Code CLI用のコマンド構築
    // 長いプロンプトの場合、一時ファイルを使用
    
    // 一時ファイルパス生成
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `claude_prompt_${Date.now()}.txt`);
    
    // プロンプトを一時ファイルに書き込み
    fs.writeFileSync(tmpFile, prompt);
    
    // ファイルからclaude CLIに入力
    let command = `cat "${tmpFile}" | claude && rm -f "${tmpFile}"`;
    
    return command;
  }

  escapePrompt(prompt) {
    // シェルコマンド用にプロンプトをエスケープ
    return prompt
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  parseGeminiResponse(response) {
    // Gemini CLIのレスポンスをパース
    try {
      // "Loaded cached credentials." メッセージを除去
      const cleanResponse = response.replace(/^Loaded cached credentials\.\s*/i, '').trim();
      
      // JSONレスポンスの場合
      if (cleanResponse.startsWith('{')) {
        const json = JSON.parse(cleanResponse);
        return json.result || json.response || cleanResponse;
      }
      
      // テキストレスポンスの場合
      return cleanResponse;
    } catch (error) {
      return response.replace(/^Loaded cached credentials\.\s*/i, '').trim();
    }
  }

  parseClaudeResponse(response) {
    // Claude Code CLIのレスポンスをパース
    try {
      // JSONレスポンスの場合
      if (response.startsWith('{')) {
        const json = JSON.parse(response);
        return json.result || json.response || response;
      }
      
      // テキストレスポンスの場合
      return response.trim();
    } catch (error) {
      return response;
    }
  }

  isAvailable(cli) {
    if (cli === 'auto') {
      return this.availableCLIs.length > 0;
    }
    return this.availableCLIs.includes(cli);
  }

  async testCLI(cli) {
    console.log(chalk.cyan(`\n🔍 ${cli} CLIテスト中...\n`));
    
    const testPrompt = 'こんにちは。これはテストメッセージです。簡単に返答してください。';
    
    try {
      const response = await this.execute(cli, testPrompt);
      console.log(chalk.green(`✅ ${cli} CLIテスト成功`));
      console.log(chalk.gray(`応答: ${response.substring(0, 100)}...`));
      return true;
    } catch (error) {
      console.log(chalk.red(`❌ ${cli} CLIテスト失敗`));
      console.log(chalk.red(`エラー: ${error.message}`));
      return false;
    }
  }

  async testAllCLIs() {
    console.log(chalk.cyan('\n🔍 全AI CLIテスト開始\n'));
    
    const results = {};
    
    for (const cli of ['gemini', 'claude']) {
      if (this.config.ai_cli_settings[cli].enabled) {
        results[cli] = await this.testCLI(cli);
      } else {
        console.log(chalk.yellow(`⚠️  ${cli} CLIは無効化されています`));
        results[cli] = false;
      }
    }
    
    console.log(chalk.cyan('\n📊 テスト結果サマリー'));
    console.log(chalk.gray('─'.repeat(30)));
    
    Object.entries(results).forEach(([cli, success]) => {
      const status = success ? chalk.green('✅ 正常') : chalk.red('❌ 異常');
      console.log(`${cli}: ${status}`);
    });
    
    console.log(chalk.gray('─'.repeat(30)));
    
    return results;
  }

  async selectBestCLI(testCase) {
    // テストケースに最適なCLIを選択
    const cliScores = {};
    
    // 各CLIのスコアを計算
    if (this.isAvailable('gemini') && this.config.ai_cli_settings.gemini.enabled) {
      cliScores.gemini = this.calculateCLIScore('gemini', testCase);
    }
    
    if (this.isAvailable('claude') && this.config.ai_cli_settings.claude.enabled) {
      cliScores.claude = this.calculateCLIScore('claude', testCase);
    }
    
    // 最高スコアのCLIを選択
    let bestCLI = null;
    let bestScore = -1;
    
    Object.entries(cliScores).forEach(([cli, score]) => {
      if (score > bestScore) {
        bestScore = score;
        bestCLI = cli;
      }
    });
    
    return bestCLI || this.config.ai_cli_settings.default_cli;
  }

  calculateCLIScore(cli, testCase) {
    let score = 0;
    
    // 基本スコア
    score += 50;
    
    // 優先度による重み付け
    if (testCase.priority === 'High') {
      // 高優先度のテストには信頼性の高いCLIを使用
      if (cli === 'claude') score += 20;
    }
    
    // カテゴリによる重み付け
    if (testCase.test_category === 'AI統合テスト') {
      // AI関連のテストには特定のCLIが適している可能性
      if (cli === 'gemini') score += 15;
    }
    
    // テストステップ数による重み付け
    if (testCase.test_steps && testCase.test_steps.length > 10) {
      // 複雑なテストには処理能力の高いCLIを使用
      if (cli === 'claude') score += 10;
    }
    
    // 過去の成功率による重み付け（将来的な実装）
    // const successRate = this.getHistoricalSuccessRate(cli, testCase.test_category);
    // score += successRate * 30;
    
    return score;
  }

  async compareResults(testCase, prompt) {
    // 複数のCLIで同じテストを実行して結果を比較
    console.log(chalk.cyan('\n🔄 CLI比較テスト開始\n'));
    
    const results = {};
    
    for (const cli of ['gemini', 'claude']) {
      if (this.isAvailable(cli) && this.config.ai_cli_settings[cli].enabled) {
        try {
          console.log(chalk.blue(`${cli}で実行中...`));
          const startTime = Date.now();
          const response = await this.execute(cli, prompt);
          const executionTime = Date.now() - startTime;
          
          results[cli] = {
            success: true,
            response: response,
            executionTime: executionTime
          };
          
          console.log(chalk.green(`✅ ${cli}完了 (${executionTime}ms)`));
        } catch (error) {
          results[cli] = {
            success: false,
            error: error.message,
            executionTime: 0
          };
          console.log(chalk.red(`❌ ${cli}失敗: ${error.message}`));
        }
      }
    }
    
    // 結果の比較分析
    this.analyzeComparisonResults(results);
    
    return results;
  }

  analyzeComparisonResults(results) {
    console.log(chalk.cyan('\n📊 比較結果分析'));
    console.log(chalk.gray('─'.repeat(40)));
    
    const successfulCLIs = Object.entries(results)
      .filter(([cli, result]) => result.success)
      .map(([cli, result]) => ({ cli, ...result }));
    
    if (successfulCLIs.length === 0) {
      console.log(chalk.red('全てのCLIが失敗しました'));
      return;
    }
    
    // 実行時間の比較
    successfulCLIs.sort((a, b) => a.executionTime - b.executionTime);
    console.log('実行時間ランキング:');
    successfulCLIs.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.cli}: ${result.executionTime}ms`);
    });
    
    // 応答長の比較
    console.log('\n応答長:');
    successfulCLIs.forEach(result => {
      const responseLength = result.response ? result.response.length : 0;
      console.log(`  ${result.cli}: ${responseLength}文字`);
    });
    
    console.log(chalk.gray('─'.repeat(40)));
  }
}

export default CLIManager;