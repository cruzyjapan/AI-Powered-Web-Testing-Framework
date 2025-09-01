#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 既存のテストケースを更新して、settings.jsonの値を使用するスクリプト

const testCasesPath = path.join(process.cwd(), 'config', 'test-cases.json');
const settingsPath = path.join(process.cwd(), 'config', 'settings.json');

if (!fs.existsSync(testCasesPath)) {
  console.log('test-cases.json が見つかりません');
  process.exit(0);
}

if (!fs.existsSync(settingsPath)) {
  console.log('settings.json が見つかりません');
  process.exit(0);
}

const testCases = JSON.parse(fs.readFileSync(testCasesPath, 'utf8'));
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

const baseUrl = settings.test_targets?.[0]?.base_url || 'http://localhost:3000';
const credentials = settings.test_targets?.[0]?.login_credentials;
const userEmail = credentials?.user?.email || 'test@example.com';
const userPassword = credentials?.user?.password || 'password123';

console.log(`Base URL: ${baseUrl}`);
console.log(`User Email: ${userEmail}`);
console.log(`Updating test cases...`);

// 各テストケースを更新
testCases.test_cases.forEach(testCase => {
  // URLをクリーンアップ
  const cleanUrl = baseUrl.replace(/\/+$/, '').replace(/\/+/g, '/').replace(':/', '://');
  
  // target_urlフィールドを追加（存在しない場合）
  if (!testCase.target_url) {
    // source_urlまたはpreconditionsから抽出
    if (testCase.test_data?.source_url) {
      testCase.target_url = testCase.test_data.source_url
        .replace(/https?:\/\/example\.com[\/]*/gi, cleanUrl)
        .replace(/https?:\/\/localhost:\d+[\/]*/g, cleanUrl)
        .replace(/\/+$/, '');
    } else {
      testCase.target_url = cleanUrl;
    }
  }
  
  // target_urlのクリーンアップ
  testCase.target_url = testCase.target_url
    .replace(/\/+$/, '')
    .replace(/\/+/g, '/')
    .replace(':/', '://');
  
  // preconditionsを更新
  testCase.preconditions = `${cleanUrl}にアクセス可能`;
  
  // source_urlを更新
  if (testCase.test_data) {
    testCase.test_data.source_url = cleanUrl;
  }
  
  // test_stepsを更新
  testCase.test_steps.forEach(step => {
    if (step.description) {
      // URLアクセスステップを簡略化
      if (step.description.includes('アクセス') && 
          (step.description.includes('http://') || step.description.includes('https://') || 
           step.description.includes('`'))) {
        step.description = 'ページにアクセスする';
        return;
      }
      
      // 正常系の認証情報を更新
      const isValidCase = testCase.test_category.includes('正常') || 
                         testCase.test_case_name.includes('正常') ||
                         (!testCase.test_category.includes('エラー') && 
                          !testCase.test_category.includes('必須') && 
                          !testCase.test_case_name.includes('無効'));
      
      if (isValidCase) {
        step.description = step.description
          .replace(/有効なユーザー名（例:\s*"[^"]*"）/gi, `「${userEmail}」`)
          .replace(/有効なユーザー名/gi, `「${userEmail}」`)
          .replace(/有効なパスワード（例:\s*"[^"]*"）/gi, `「${userPassword}」`)
          .replace(/有効なパスワード/gi, `「${userPassword}」`)
          .replace(/testuser/gi, userEmail)
          .replace(/test@example\.com/gi, userEmail)
          .replace(/password123/gi, userPassword);
      }
    }
    
    if (step.target) {
      step.target = step.target
        .replace(/https?:\/\/example\.com/gi, baseUrl)
        .replace(/https?:\/\/localhost:\d+/g, baseUrl);
    }
    
    if (step.value === '${user.email}') {
      step.value = userEmail;
    }
    if (step.value === '${user.password}') {
      step.value = userPassword;
    }
  });
});

// ファイルを保存
fs.writeFileSync(testCasesPath, JSON.stringify(testCases, null, 2), 'utf8');
console.log('✅ テストケースを更新しました');