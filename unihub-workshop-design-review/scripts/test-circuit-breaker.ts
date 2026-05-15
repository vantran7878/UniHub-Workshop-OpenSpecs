import { PaymentCircuitBreaker } from '../lib/payments/PaymentCircuitBreaker';

async function mockExternalService(shouldFail: boolean) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) {
        reject(new Error('External Payment Service Failure'));
      } else {
        resolve({ success: true, transactionId: 'MOCK_TXN_123' });
      }
    }, 100);
  });
}

async function runTest() {
  console.log('🚀 Starting Circuit Breaker Test...');
  
  // Lấy instance của breaker cho hàm mock service
  // Lưu ý: Trong thực tế, breaker này sẽ bọc simulatePaymentGateway
  const breaker = PaymentCircuitBreaker.getBreaker(mockExternalService);

  // 1. Gây ra một loạt lỗi để kích hoạt ngắt mạch
  console.log('\n--- Step 1: Generating errors to open the circuit ---');
  for (let i = 1; i <= 6; i++) {
    try {
      console.log(`Call #${i}: Attempting payment...`);
      await breaker.fire(true); // Luôn thất bại
    } catch (err: any) {
      console.log(`Call #${i} Result: ❌ ${err.message}`);
    }
  }

  // 2. Kiểm tra xem mạch đã mở chưa
  console.log('\n--- Step 2: Verifying circuit state ---');
  try {
    console.log('Attempting call when circuit should be OPEN...');
    await breaker.fire(false); // Dù service có thể thành công, mạch vẫn phải ngắt
  } catch (err: any) {
    if (err.name === 'CircuitBreakerOpenException') {
      console.log('✅ SUCCESS: Circuit is OPEN and rejected the request immediately (Fail-Fast).');
    } else {
      console.log(`❌ FAILED: Expected CircuitBreakerOpenException but got: ${err.name}`);
    }
  }

  console.log('\n--- Step 3: Waiting for reset timeout (Half-Open) ---');
  console.log('Waiting 31 seconds (resetTimeout is 30s)...');
  
  await new Promise(resolve => setTimeout(resolve, 31000));

  try {
    console.log('Attempting call in HALF-OPEN state...');
    const result = await breaker.fire(false); // Thành công
    console.log('✅ SUCCESS: Circuit allowed a request in HALF-OPEN state and it succeeded.');
    console.log('Circuit should now be CLOSED again.');
  } catch (err: any) {
    console.log(`❌ FAILED: Circuit should have allowed the request but got: ${err.message}`);
  }

  process.exit(0);
}

runTest();
