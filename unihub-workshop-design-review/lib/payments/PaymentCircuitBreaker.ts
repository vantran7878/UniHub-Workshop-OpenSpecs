import CircuitBreaker from 'opossum';

const options = {
  timeout: 5000, // Nếu request mất hơn 5s, coi như lỗi
  errorThresholdPercentage: 50, // Ngắt mạch khi 50% yêu cầu lỗi
  resetTimeout: 30000, // Chờ 30s trước khi thử lại (Half-Open)
};

export class PaymentCircuitBreaker {
  private static breaker: CircuitBreaker;

  public static getBreaker<T>(action: (...args: any[]) => Promise<T>): CircuitBreaker {
    if (!this.breaker) {
      this.breaker = new CircuitBreaker(action, options);

      this.breaker.on('open', () => {
        console.warn('🔴 [Circuit Breaker] Payment circuit is OPEN. Switching to fallback.');
      });

      this.breaker.on('close', () => {
        console.info('🟢 [Circuit Breaker] Payment circuit is CLOSED. Normal operation resumed.');
      });

      this.breaker.on('halfOpen', () => {
        console.info('🟡 [Circuit Breaker] Payment circuit is HALF-OPEN. Testing service health.');
      });
    }
    return this.breaker;
  }
}
