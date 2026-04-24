/**
 * nvproxyjs 测试脚本
 * 用于测试 NVIDIA API 代理服务的基本功能
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:8787';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName) {
  console.log('\n' + '='.repeat(50));
  log(`测试: ${testName}`, 'blue');
  console.log('='.repeat(50));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// 测试用例
async function testHealthCheck() {
  logTest('健康检查');
  
  try {
    const response = await fetch(`${BASE_URL}/v1/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      logSuccess(`健康检查通过 - 状态: ${response.status}`);
      log(`响应数据: ${JSON.stringify(data).substring(0, 100)}...`);
      return true;
    } else {
      logError(`健康检查失败 - 状态: ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`健康检查异常: ${error.message}`);
    return false;
  }
}

async function testChatCompletion() {
  logTest('聊天完成测试');
  
  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-405b-instruct',
        messages: [
          { role: 'user', content: 'Hello, how are you?' }
        ],
        max_tokens: 50,
        stream: false
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      logSuccess(`聊天完成测试通过 - 状态: ${response.status}`);
      if (data.choices && data.choices[0]) {
        log(`响应内容: ${data.choices[0].message.content.substring(0, 100)}...`);
      }
      return true;
    } else {
      const errorText = await response.text();
      logError(`聊天完成测试失败 - 状态: ${response.status}`);
      log(`错误详情: ${errorText.substring(0, 200)}`);
      return false;
    }
  } catch (error) {
    logError(`聊天完成测试异常: ${error.message}`);
    return false;
  }
}

async function testStreamingChat() {
  logTest('流式聊天测试');
  
  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-405b-instruct',
        messages: [
          { role: 'user', content: 'Say hello' }
        ],
        max_tokens: 30,
        stream: true
      })
    });
    
    if (response.ok) {
      logSuccess(`流式聊天测试通过 - 状态: ${response.status}`);
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let chunkCount = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        chunkCount++;
        
        if (chunkCount <= 3) {
          log(`数据块 ${chunkCount}: ${chunk.substring(0, 50)}...`);
        }
      }
      
      log(`总共接收 ${chunkCount} 个数据块`);
      return true;
    } else {
      logError(`流式聊天测试失败 - 状态: ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`流式聊天测试异常: ${error.message}`);
    return false;
  }
}

async function testCORS() {
  logTest('CORS 测试');
  
  try {
    const response = await fetch(`${BASE_URL}/v1/models`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'GET'
      }
    });
    
    const corsHeaders = response.headers.get('Access-Control-Allow-Origin');
    
    if (corsHeaders === '*') {
      logSuccess('CORS 配置正确');
      return true;
    } else {
      logWarning('CORS 配置可能需要检查');
      return false;
    }
  } catch (error) {
    logError(`CORS 测试异常: ${error.message}`);
    return false;
  }
}

async function testAuthentication() {
  logTest('鉴权测试');
  
  if (!AUTH_TOKEN) {
    logWarning('未设置 AUTH_TOKEN，跳过鉴权测试');
    return true;
  }
  
  try {
    // 测试无效 Token
    const response = await fetch(`${BASE_URL}/v1/models`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer invalid_token'
      }
    });
    
    if (response.status === 401) {
      logSuccess('鉴权保护正常工作');
      return true;
    } else {
      logWarning('鉴权配置可能需要检查');
      return false;
    }
  } catch (error) {
    logError(`鉴权测试异常: ${error.message}`);
    return false;
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('\n🧪 nvproxyjs 测试套件');
  console.log(`📍 测试目标: ${BASE_URL}`);
  console.log(`🔑 认证 Token: ${AUTH_TOKEN ? '已设置' : '未设置'}`);
  
  const results = {
    '健康检查': await testHealthCheck(),
    '聊天完成': await testChatCompletion(),
    '流式聊天': await testStreamingChat(),
    'CORS': await testCORS(),
    '鉴权': await testAuthentication()
  };
  
  // 汇总结果
  console.log('\n' + '='.repeat(50));
  log('测试结果汇总', 'blue');
  console.log('='.repeat(50));
  
  let passed = 0;
  let failed = 0;
  
  for (const [testName, result] of Object.entries(results)) {
    if (result) {
      logSuccess(`${testName}: 通过`);
      passed++;
    } else {
      logError(`${testName}: 失败`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  log(`总计: ${passed} 通过, ${failed} 失败`, failed > 0 ? 'red' : 'green');
  console.log('='.repeat(50) + '\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

// 运行测试
runAllTests().catch(error => {
  logError(`测试运行失败: ${error.message}`);
  process.exit(1);
});